import base64
from functools import partial, wraps
import logging
import os
from threading import Lock

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, disconnect, emit

from ImageTextToTextPipeline import ImageTextToTextPipeline

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=3600, ping_interval=1800)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

pipeline = ImageTextToTextPipeline()
prompt_config_ready = set()

vlm_model_switch_lock = Lock()
vlm_model_switch_state_lock = Lock()
vlm_model_switching = False


def emit_vlm_model_state(session_id=None, is_switching=False, message=None):
    payload = {**pipeline.get_model_state(), "is_switching": is_switching, "message": message}
    target = {} if session_id is None else {"to": session_id}
    socketio.emit("vlm_model_state", payload, **target)
    socketio.emit("model", payload["model_id"], **target)


def set_vlm_model_switching(value):
    global vlm_model_switching
    with vlm_model_switch_state_lock:
        vlm_model_switching = value


def is_vlm_model_switching():
    with vlm_model_switch_state_lock:
        return vlm_model_switching


def abort_all_vlm_work():
    for session_id in list(pipeline.sessions.keys()):
        pipeline.abort_generation(session_id)


def change_vlm_model(requested_model_id):
    if not requested_model_id:
        raise ValueError('Invalid request. "model_id" is required.')

    # Same-model click: skip the switch (and the "model" broadcast that
    # would trigger the frontend to reset its client state and wipe an
    # active dialog).
    if requested_model_id == pipeline.original_model_id:
        return {**pipeline.get_model_state(), "is_switching": False, "message": None}

    with vlm_model_switch_lock:
        set_vlm_model_switching(True)
        emit_vlm_model_state(is_switching=True, message="Switching VLM model...")
        try:
            abort_all_vlm_work()
            model_state = pipeline.switch_model(requested_model_id)
            payload = {**model_state, "is_switching": False, "message": None}
            socketio.emit("vlm_model_state", payload)
            socketio.emit("model", payload["model_id"])
            return payload
        except Exception as exc:
            emit_vlm_model_state(is_switching=False, message=str(exc))
            raise
        finally:
            set_vlm_model_switching(False)


def getsid(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_id = request.sid  # type: ignore
        if not session_id:
            logging.error(f"[{session_id}] No session Id found in request.")
            disconnect()
            return
        return f(session_id, *args, **kwargs)

    return decorated_function


def on_image_processing_done(session_id):
    logging.info(f"[{session_id}] - Image processing finished. Emitting signal.")
    socketio.emit("image", {}, to=session_id)


def on_token(token, session_id):
    socketio.emit("token", token, to=session_id)


def on_end(is_aborted, session_id, temp_file_path=None):
    socketio.emit("end", is_aborted, to=session_id)
    logging.info(f"[{session_id}] - Stream ended. Aborted: {is_aborted}")


@socketio.on("connect")
@getsid
def handle_connect(session_id):
    logging.info(f"[{session_id}] - Session connected.")
    pipeline.reset_session(session_id)
    prompt_config_ready.discard(session_id)
    socketio.emit("prompt_config_state", {"is_ready": False, "message": "Prompt bundle is not synced yet."}, to=session_id)
    socketio.emit("model", pipeline.original_model_id, to=session_id)


@socketio.on("disconnect")
@getsid
def handle_disconnect(session_id):
    pipeline.abort_generation(session_id)
    prompt_config_ready.discard(session_id)
    logging.info(f"[{session_id}] - Session disconnected.")


@socketio.on("prompt_config")
@getsid
def handle_prompt_config(session_id, prompt_config):
    if not isinstance(prompt_config, dict):
        emit("error", {"message": "Prompt config payload is invalid."}, to=session_id)
        return

    system_prompt = prompt_config.get("system_prompt", "")
    inter_prompt = prompt_config.get("inter_prompt", "")

    socketio.emit("prompt_config_state", {"is_ready": False, "message": "Applying prompt bundle..."}, to=session_id)
    prompt_config_ready.discard(session_id)
    pipeline.abort_generation(session_id)
    pipeline.set_session_prompts(session_id, system_prompt, inter_prompt)
    prompt_config_ready.add(session_id)
    socketio.emit("prompt_config_state", {"is_ready": True, "message": None}, to=session_id)
    emit("prompt_config_saved", to=session_id)


@socketio.on("ask")
@getsid
def handle_ask(session_id, question, base64image=None):
    if is_vlm_model_switching():
        emit("error", {"message": "VLM model is switching. Please try again shortly."}, to=session_id)
        return

    if session_id not in prompt_config_ready:
        emit("error", {"message": "Prompt bundle is not ready yet."}, to=session_id)
        return

    if not question:
        logging.warning(f"[{session_id}] - Invalid request received. Missing question.")
        emit("error", {"message": 'Invalid request. "question" is required.'}, to=session_id)
        return

    logging.info(f"[{session_id}] - Received 'ask' request.")

    temp_image_path = None
    on_image_done_callback = None

    try:
        if base64image:
            header, encoded = base64image.split(",", 1)
            image_data = base64.b64decode(encoded)
            temp_image_path = os.path.join(f"./src", f"temp.jpg")

            with open(temp_image_path, "wb") as f:
                f.write(image_data)
            logging.info(f"[{session_id}] - Saved temp image to {temp_image_path}")

            on_image_done_callback = partial(on_image_processing_done, session_id=session_id)

        on_token_callback = partial(on_token, session_id=session_id)
        on_end_callback = partial(on_end, session_id=session_id, temp_file_path=temp_image_path)

        emit("start", {}, to=session_id)
        pipeline.generate_stream(
            session_id,
            temp_image_path,
            question,
            on_token_callback,
            on_end_callback,
            on_image_done_callback,
        )

    except Exception as e:
        logging.error(f"[{session_id}] - Error during ask inference: {e}")
        emit("error", {"message": "Failed to process the ask request."}, to=session_id)

        if temp_image_path and os.path.exists(temp_image_path):
            os.remove(temp_image_path)


@socketio.on("abort")
@getsid
def handle_abort(session_id):
    pipeline.abort_generation(session_id)


@socketio.on("reset")
@getsid
def handle_reset(session_id):
    pipeline.abort_generation(session_id)
    pipeline.reset_session(session_id)


@socketio.on("vlm_models:get")
@getsid
def handle_vlm_models_get(session_id):
    emit_vlm_model_state(session_id)


@socketio.on("vlm_model:set")
@getsid
def handle_vlm_model_set(session_id, payload):
    try:
        requested_model_id = payload.get("model_id") if isinstance(payload, dict) else payload
        change_vlm_model(requested_model_id)
    except Exception as exc:
        logging.error(f"[{session_id}] - Failed to switch VLM model: {exc}")
        emit_vlm_model_state(session_id=None, is_switching=False, message=str(exc))
        emit("error", {"message": str(exc)}, to=session_id)


@app.route("/models", methods=["GET"])
def get_vlm_models():
    return jsonify(pipeline.get_model_state())


@app.route("/model", methods=["POST"])
def post_vlm_model():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(change_vlm_model(payload.get("model_id")))
    except Exception as exc:
        logging.error("Failed to switch VLM model via HTTP: %s", exc)
        emit_vlm_model_state(session_id=None, is_switching=False, message=str(exc))
        return jsonify({**pipeline.get_model_state(), "ok": False, "message": str(exc)}), 400


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)
