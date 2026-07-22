import torch
import logging
import traceback
import re
import os
import gc
from threading import Event, RLock, Thread
from typing import Callable, Dict, List, Optional
from contextlib import contextmanager
import types, functools, inspect
from qbruntime import Accelerator

from transformers import (
    TextIteratorStreamer,
    GenerationConfig,
    AutoProcessor,
    AutoModelForImageTextToText,
    LogitsProcessor,
    LogitsProcessorList,
)


class PresencePenaltyLogitsProcessor(LogitsProcessor):
    """OpenAI/vLLM-style additive presence penalty over tokens generated in
    the current call. Unlike the multiplicative repetition_penalty it never
    touches the EOS token (not yet generated), so it discourages repetition
    without suppressing termination, and unlike no_repeat_ngram_size it does
    not force broken-token variants. Enabled by a "presence_penalty" key in
    the generation config JSON; inert otherwise."""

    def __init__(self, penalty: float, prompt_length: int):
        self.penalty = penalty
        self.prompt_length = prompt_length

    def __call__(self, input_ids, scores):
        generated = input_ids[:, self.prompt_length:]
        if generated.numel() == 0:
            return scores
        for batch_index in range(scores.shape[0]):
            seen = torch.unique(generated[batch_index])
            scores[batch_index, seen] -= self.penalty
        return scores


@contextmanager
def get_image_features_callback(model, callback: Optional[Callable] = None):
    original = model.get_image_features

    @functools.wraps(original)
    def patched(*args, **kwargs):
        out = original(*args, **kwargs)
        if callback:
            callback()
        return out

    model.get_image_features = types.MethodType(patched, model)
    try:
        model.get_image_features.__signature__ = inspect.signature(original)
    except Exception:
        pass
    try:
        yield
    finally:
        model.get_image_features = original


class StopOnSignalTextIteratorStreamer(TextIteratorStreamer):
    def __init__(self, tokenizer, stop_event, **kwargs):
        super().__init__(tokenizer, **kwargs)
        self.stop_event = stop_event

    def put(self, value):
        if self.stop_event.is_set():    
            self.end_of_stream = True
            raise StopIteration()
        super().put(value)


class ImageTextToTextPipeline:
    DEFAULT_MODEL_ID = "Qwen/Qwen3-VL-2B-Instruct"

    def __init__(self):
        self._configure_logging()
        self.model_lock = RLock()
        self.available_model_ids = self._load_available_model_ids()
        self.original_model_id = self.available_model_ids[0]
        self._detect_devices()
        self.model_id = self._select_device_and_model(self.original_model_id)
        self.model, self.processor = self._load_model_and_processor(self.model_id)
        self.sessions: Dict[str, Dict] = {}

    def _configure_logging(self) -> None:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    def _load_available_model_ids(self) -> List[str]:
        configured_models = os.getenv("VLM_MODEL_IDS", "")
        model_ids = [model_id.strip() for model_id in configured_models.split(",") if model_id.strip()]
        if not model_ids:
            model_ids = [
                self.DEFAULT_MODEL_ID,
                "Qwen/Qwen2-VL-2B-Instruct",
                "Qwen/Qwen3-VL-4B-Instruct",
                "Qwen/Qwen3-VL-8B-Instruct",
            ]

        return list(dict.fromkeys(model_ids))

    def _detect_devices(self) -> None:
        gpu_available = torch.cuda.is_available()
        npu_available = False

        try:
            acc = Accelerator()
            del acc
            npu_available = True
        except Exception:
            pass

        logging.info(f'[DEVICE] GPU: {"O" if gpu_available else "X"}, NPU: {"O" if npu_available else "X"}')

        if not gpu_available and not npu_available:
            raise SystemError("No AI Accelerator Found!")

        self.gpu_available = gpu_available
        self.is_npu = npu_available

    def _select_device_and_model(self, model_name: str) -> str:
        if self.is_npu and not model_name.startswith("mobilint/"):
            return re.sub(r"^[^/]+", "mobilint", model_name)
        if self.is_npu:
            return model_name
        if self.gpu_available:
            return model_name

        raise RuntimeError("[DEVICE] No available AI accelerator!")

    def get_model_state(self):
        return {
            "model_id": self.original_model_id,
            "runtime_model_id": self.model_id,
            "available_models": self.available_model_ids,
            "is_npu": self.is_npu,
        }

    def _stop_and_join_active_sessions(self, timeout: float = 10.0) -> None:
        """Signal every session's generation to stop and wait for its
        task+streamer threads to exit. abort_generation only flips the
        stop event; we must also join so no thread is still inside
        model.generate() when we dispose the model."""
        for session in list(self.sessions.values()):
            stop_event = session.get("stop_event")
            if stop_event is not None:
                stop_event.set()

        for session_id, session in list(self.sessions.items()):
            for thread_key in ("streamer_thread", "task_thread"):
                thread = session.get(thread_key)
                if thread is None or not thread.is_alive():
                    continue
                thread.join(timeout=timeout)
                if thread.is_alive():
                    raise RuntimeError(
                        f"[{session_id}] - {thread_key} did not finish within "
                        f"{timeout:.1f}s during model switch; refusing to dispose "
                        "model while a worker may still be inside generate()."
                    )

    def _dispose_model_resources(self, model=None, processor=None) -> None:
        if model is None and processor is None:
            return
        try:
            if model is not None and hasattr(model, "dispose"):
                logging.info("Disposing current VLM model resources.")
                model.dispose()
        except Exception as exc:
            logging.warning("Failed to dispose current VLM model cleanly: %s", exc)
        finally:
            if model is not None:
                del model
            if processor is not None:
                del processor
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    def switch_model(self, requested_model_id: str):
        if requested_model_id not in self.available_model_ids:
            raise ValueError(f"Unsupported VLM model: {requested_model_id}")
        if requested_model_id == self.original_model_id:
            return self.get_model_state()

        next_runtime_model_id = self._select_device_and_model(requested_model_id)

        with self.model_lock:
            previous_original_model_id = self.original_model_id
            previous_runtime_model_id = self.model_id
            logging.info("Switching VLM model from %s (%s) to %s (%s)",
                         previous_original_model_id, previous_runtime_model_id,
                         requested_model_id, next_runtime_model_id)

            current_model = self.model
            current_processor = self.processor
            self.model = None
            self.processor = None

            # Wait until any in-flight generate() call has returned before
            # we release the model backing it. reset_session only clears
            # session dicts; joining threads is what guarantees no worker
            # is still touching the model.
            self._stop_and_join_active_sessions()

            self._dispose_model_resources(current_model, current_processor)
            del current_model
            del current_processor

            try:
                next_model, next_processor = self._load_model_and_processor(next_runtime_model_id)
                self.original_model_id = requested_model_id
                self.model_id = next_runtime_model_id
                self.model = next_model
                self.processor = next_processor
            except Exception as switch_exc:
                logging.exception("Failed to load %s (%s). Reloading previous %s (%s).",
                                  requested_model_id, next_runtime_model_id,
                                  previous_original_model_id, previous_runtime_model_id)
                self.original_model_id = previous_original_model_id
                self.model_id = previous_runtime_model_id
                try:
                    recovered_model, recovered_processor = self._load_model_and_processor(previous_runtime_model_id)
                except Exception as recovery_exc:
                    self.model = None
                    self.processor = None
                    raise RuntimeError(
                        f"Failed to switch VLM model to {requested_model_id}, "
                        f"and failed to recover previous model {previous_original_model_id}."
                    ) from recovery_exc
                self.model = recovered_model
                self.processor = recovered_processor
                for session_id in list(self.sessions.keys()):
                    self.reset_session(session_id)
                raise RuntimeError(
                    f"Failed to switch VLM model to {requested_model_id}. "
                    f"Recovered previous model {previous_original_model_id}."
                ) from switch_exc

            for session_id in list(self.sessions.keys()):
                self.reset_session(session_id)

        return self.get_model_state()

    def _load_model_and_processor(self, model_id: str):
        logging.info(f"Loading processor for model: {model_id}")
        processor = AutoProcessor.from_pretrained(
            model_id,
            trust_remote_code=True,
            use_fast=True
        )

        logging.info(f"Loading model: {model_id}")
        model = AutoModelForImageTextToText.from_pretrained(
            model_id,
            trust_remote_code=True,
        ).to("cpu" if self.is_npu else "cuda:0")
        return model, processor

    def reset_session(self, session_id: str):
        existing_session = self.sessions.get(session_id, {})
        self.sessions[session_id] = {
            "past_key_values": None,
            "system_prompt": existing_session.get("system_prompt", ""),
            "inter_prompt": existing_session.get("inter_prompt", ""),
            "conversation": [],
        }
        self._apply_session_prompt(session_id)
        logging.info(f"[{session_id}] - Cache has been reset.")

    def set_session_prompts(self, session_id: str, system_prompt: str, inter_prompt: str = ""):
        if session_id not in self.sessions:
            self.reset_session(session_id)

        self.sessions[session_id]["system_prompt"] = system_prompt or ""
        self.sessions[session_id]["inter_prompt"] = inter_prompt or ""
        self._apply_session_prompt(session_id)
        logging.info(f"[{session_id}] - Session prompts updated.")

    def _apply_session_prompt(self, session_id: str):
        session = self.sessions[session_id]
        prompt_parts = [session.get("system_prompt", "").strip()]
        inter_prompt = session.get("inter_prompt", "").strip()

        if inter_prompt:
            prompt_parts.append(inter_prompt)

        merged_prompt = "\n\n".join(part for part in prompt_parts if part)

        session["past_key_values"] = None
        session["conversation"] = []

        if merged_prompt:
            session["conversation"].append(
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "text",
                            "text": merged_prompt,
                        }
                    ],
                }
            )

    def generate_stream(
        self,
        session_id: str,
        image_url: Optional[str],
        text_prompt: str,
        on_token: Callable,
        on_end: Callable,
        on_image_processing_done: Optional[Callable] = None,
    ):
        if self.model is None or self.processor is None:
            raise RuntimeError("Pipeline is not available.")

        # Defense-in-depth: Socket.IO serializes emits per session on the
        # client side, so overlapping generate_stream calls for one session
        # are not expected. This check is a TOCTOU without a lock and is not
        # the primary mutual exclusion; it only catches accidental races.
        if (
            session_id in self.sessions
            and self.sessions[session_id].get("task_thread")
            and self.sessions[session_id]["task_thread"].is_alive()
        ):
            logging.warning(f"[{session_id}] - Generation is already in progress")
            return

        if session_id not in self.sessions:
            self.reset_session(session_id)

        stop_event = Event()
        streamer = StopOnSignalTextIteratorStreamer(
            self.processor.tokenizer,
            stop_event,
            skip_prompt=True,
            skip_special_tokens=True,
        )

        def task():
            try:
                content = []
                if image_url:
                    content.append({"type": "image", "url": image_url})
                content.append({"type": "text", "text": text_prompt})

                self.sessions[session_id]["conversation"].append({"role": "user", "content": content})
                
                inputs = self.processor.apply_chat_template(
                    self.sessions[session_id]["conversation"],
                    padding=True,
                    tokenize=True,
                    add_generation_prompt=True,
                    return_dict=True,
                    return_tensors="pt",
                ).to("cpu" if self.is_npu else "cuda:0")

                # generation_config.<model-name>.json overrides the shared
                # config for models that need different sampling.
                model_short_name = (self.model_id or "").split("/")[-1]
                override_name = f"generation_config.{model_short_name}.json"
                if os.path.exists(os.path.join("./src", override_name)):
                    generation_config = GenerationConfig.from_pretrained("./src/", config_file_name=override_name)
                else:
                    # stress harness sets VLM_GEN_CONFIG_OVERRIDE to swap in a
                    # temp config without touching shipped generation_config.json
                    base_override = os.environ.get("VLM_GEN_CONFIG_OVERRIDE")
                    if base_override and os.path.exists(os.path.join("./src", base_override)):
                        generation_config = GenerationConfig.from_pretrained("./src/", config_file_name=base_override)
                    else:
                        generation_config = GenerationConfig.from_pretrained("./src/")

                # The shared config's token ids are Qwen-specific. Keep the
                # active model's own ids so non-Qwen models (e.g. aya) still
                # emit their EOS and stop instead of running to the cap.
                model_generation_config = getattr(self.model, "generation_config", None)
                if model_generation_config is not None:
                    generation_config.bos_token_id = model_generation_config.bos_token_id
                    generation_config.eos_token_id = model_generation_config.eos_token_id
                    generation_config.pad_token_id = (
                        model_generation_config.pad_token_id
                        if model_generation_config.pad_token_id is not None
                        else model_generation_config.eos_token_id
                    )

                # Re-encode the full conversation every turn and let the
                # model build a fresh cache. Reusing the previous turn's
                # past_key_values while also passing the full re-encoded
                # conversation double-counts the prefix (position mismatch)
                # and makes follow-up turns emit an immediate EOS (empty
                # answer). The conversation list already holds full history.
                generation_kwargs = dict(
                    **inputs,
                    streamer=streamer,
                    use_cache=True,
                )

                presence_penalty = getattr(generation_config, "presence_penalty", None)
                if presence_penalty is not None and presence_penalty > 0:
                    generation_kwargs["logits_processor"] = LogitsProcessorList([
                        PresencePenaltyLogitsProcessor(
                            float(presence_penalty), inputs["input_ids"].shape[1],
                        )
                    ])

                with get_image_features_callback(self.model, on_image_processing_done):
                    self.model.generate(generation_config=generation_config, **generation_kwargs)

            except StopIteration:
                logging.info(f"[{session_id}] - Generation task aborted by user.")

            except Exception as e:
                logging.error(f"[{session_id}] - Error in task thread: {e}\n {traceback.format_exc()}")

            finally:
                streamer.end()

        task_thread = Thread(target=task)

        def streamer_loop():
            answer = ""
            is_aborted = False
            try:
                for token in streamer:
                    answer += token
                    on_token(token)

            except Exception as e:
                logging.warning(f"[{session_id}] - Streamer loop interrupted: {e}")
                is_aborted = True

            finally:
                task_thread.join()

                if not is_aborted:
                    assistant_content = [{"type": "text", "text": answer}]
                    self.sessions[session_id]["conversation"].append(
                        {"role": "assistant", "content": assistant_content}
                    )
                # print(f"[DEBUG] model answer: {answer}")

                on_end(is_aborted)

        streamer_thread = Thread(target=streamer_loop)

        self.sessions[session_id].update(
            {
                "task_thread": task_thread,
                "streamer_thread": streamer_thread,
                "stop_event": stop_event,
            }
        )

        task_thread.start()
        streamer_thread.start()

    def abort_generation(self, session_id: str):
        if session_id in self.sessions and "stop_event" in self.sessions[session_id]:
            logging.info(f"[{session_id}] - Aborting generation.")
            self.sessions[session_id]["stop_event"].set()

        else:
            logging.warning(f"[{session_id}] - No active generation to abort")
