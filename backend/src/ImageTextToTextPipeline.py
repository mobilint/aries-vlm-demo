import os
from pathlib import Path
import shutil
import torch
import logging
import traceback
import re
from threading import Event, Thread
from typing import Callable, Dict, Optional
from contextlib import contextmanager
import types, functools, inspect

from transformers import DynamicCache, TextIteratorStreamer
from mblt_model_zoo.transformers import AutoProcessor, AutoModelForImageTextToText
from mblt_model_zoo.transformers.utils import MobilintCache


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
    def __init__(self):
        self._configure_logging()
        self.model_id = self._select_device_and_model()
        self.model, self.processor = self._load_model_and_processor(self.model_id)
        self.sessions: Dict[str, Dict] = {}

    def _configure_logging(self) -> None:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    def _select_device_and_model(self) -> str:
        model_name = "Qwen/Qwen2-VL-2B-Instruct"

        gpu_available = torch.cuda.is_available()
        npu_available = os.path.exists("/dev/aries0")

        logging.info(f'[DEVICE] GPU: {"O" if gpu_available else "X"}, NPU: {"O" if npu_available else "X"}')

        if npu_available:
            return re.sub(r"^[^/]+", "mobilint", model_name)
        if gpu_available:
            return model_name

        raise RuntimeError("[DEVICE] No available AI accelerator!")

    def _load_model_and_processor(self, model_id: str):
        logging.info(f"Loading processor for model: {model_id}")
        processor = AutoProcessor.from_pretrained(model_id)

        logging.info(f"Loading model: {model_id}")
        model = AutoModelForImageTextToText.from_pretrained(model_id, device_map="auto")
        return model, processor

    def _get_history_path(self, session_id: str) -> Path:
        return os.path.join("./history", session_id)

    def reset_session(self, session_id: str):
        with open("prompt.txt", "r") as f:
            self.sessions[session_id] = {
                "past_key_values": (
                    MobilintCache(self.model.language_model.mxq_model)
                    if self.model_id.startswith("mobilint/")
                    else DynamicCache()
                ),
                "conversation": [{
                    "role": "system",
                    "content": [{
                        "type": "text",
                        "text": f.read(),
                    }]
                }],
            }
            
        history_path = self._get_history_path(session_id)
        if os.path.isdir(history_path):
            shutil.rmtree(history_path)

        os.makedirs(history_path, exist_ok=True)
        logging.info(f"[{session_id}] - Cache and history have been reset.")

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
                ).to(self.model.device)

                generation_kwargs = dict(
                    **inputs,
                    streamer=streamer,
                    max_new_tokens=600,
                    past_key_values=self.sessions[session_id]["past_key_values"],
                    use_cache=True,
                )

                if self.sessions[session_id]["past_key_values"].get_seq_length() > 3900:
                    logging.warning(
                        "Size of cache exceeded, reseting... (%i)"
                        % self.sessions[session_id]["past_key_values"].get_seq_length()
                    )
                    self.reset_cache(session_id)

                with get_image_features_callback(self.model, on_image_processing_done):
                    self.model.generate(**generation_kwargs)

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
                on_end(is_aborted=is_aborted)

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
