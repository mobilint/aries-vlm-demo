import base64
from functools import partial, wraps
import logging
import os
import shutil
import uuid

from flask import Flask, request
from flask_socketio import SocketIO, disconnect, emit

from ImageTextToTextPipeline import ImageTextToTextPipeline

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=3600, ping_interval=1800)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

pipeline = ImageTextToTextPipeline()


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


@socketio.on("disconnect")
@getsid
def handle_disconnect(session_id):
    pipeline.abort_generation(session_id)

    history_path = pipeline._get_history_path(session_id)
    if os.path.isdir(history_path):
        shutil.rmtree(history_path)

    logging.info(f"[{session_id}] - Session disconnected.")


@socketio.on("ask")
@getsid
def handle_ask(session_id, question, base64image=None):
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
            temp_image_path = os.path.join(f"./history/{session_id}", f"{uuid.uuid4()}.jpg")

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


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)
