"use client";

import React, { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import {
  Typography,
  Grid,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import ActivablePanel from "./components/ActivablePanel";
import ImageSelector from "./components/ImageSelector";
import Webcam from "react-webcam";
import Chat from "./components/Chat";
import { DialogType, QNA } from "./components/type";

const theme = createTheme({
  typography: {
    fontFamily: "Pretendard",
  },
});

export default function Page() {
  const socket = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tasksNum, setTasksNum] = useState(0);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>("");
  const [dialog, setDialog] = useState<DialogType>([]);
  const [recentAnswer, setRecentAnswer] = useState<string | null>(null);
  const recentAnswerRef = useRef<string | null>(recentAnswer);
  const dialogRef = useRef<QNA[]>(dialog);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const webcamRef = useRef<Webcam | null>(null);

  const tokenBufRef = useRef<string>("");

  recentAnswerRef.current = recentAnswer;
  dialogRef.current = dialog;

  function onConnect() {
    setIsConnected(true);
    reset();
  }

  function onDisconnect() {
    setIsConnected(false);
  }

  function onTasks(tasks: number) {
    setTasksNum(tasks);
  }

  function onStart() {
    console.log("[event] start");
    tokenBufRef.current = ""; 
    setIsAnswering(true);
  }

  function onToken(token: string) {
    tokenBufRef.current += token;
    setRecentAnswer((old) => (old == null ? token : old + token)); 
  }

  function onEnd(isAborted: boolean) {
    console.log("[event] end", isAborted);
    const finalText = tokenBufRef.current; 
    console.log("[debug] model response: ", finalText);
    tokenBufRef.current = ""; 

    const newDialog = [...dialogRef.current];
    if (newDialog.length > 0) {  
      newDialog[newDialog.length - 1].answer = finalText; 
    }

    setDialog(newDialog);
    setIsAnswering(false);
    setRecentAnswer(null);
  }


  useEffect(() => {
    socket.current = io(`${window.location.protocol == 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:5000`);
    socket.current.on('connect', onConnect);
    socket.current.on('disconnect', onDisconnect);
    socket.current.on('tasks', onTasks);
    socket.current.on('start', onStart);
    socket.current.on('token', onToken);
    socket.current.on('end', onEnd);

    return () => {
      if (socket.current) {
        socket.current.disconnect();
        socket.current.off('connect', onConnect);
        socket.current.off('disconnect', onDisconnect);
        socket.current.off('tasks', onTasks);
        socket.current.off('start', onStart);
        socket.current.off('token', onToken);
        socket.current.off('end', onEnd);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ask(new_question: string) {
    if (socket.current && new_question != "") {
      setDialog((prevDialog) => {
        const newDialog = [...prevDialog];
        newDialog.push({ image: dialog.length > 0 ? null : imageSrc, question: new_question, answer: null });
        return newDialog;
      });
      setQuestion("");
      socket.current.emit("ask", new_question, dialog.length > 0 ? null : imageSrc);
    }
  }

  function abort() {
    if (socket.current)
      socket.current.emit("abort");
  }

  function reset() {
    if (socket.current) {
      console.log("reset");
      if (dialog.length > 0)
        socket.current.emit("reset");

      setDialog([]);
      setRecentAnswer(null);
      setImageSrc(null);
    }
  }

  function capture() {
    if (socket.current && webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc == null) {
        return;
      }

      setImageSrc(imageSrc);
    }
  }

  if (isConnected == false)
    return undefined;

  return (
    <ThemeProvider theme={theme}>
      <Grid
        container
        direction="column"
        wrap="nowrap"
        rowSpacing={"38px"}
        sx={{
          width: "100vw",
          height: "100vh",
          padding: "40px 40px",
        }}
      >
        <Grid
          container
          alignItems={"center"}
        >
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "40px",
              lineHeight: "130%",
              letterSpacing: "-0.2px",
              verticalAlign: "middle",
              color: "#FFFFFF",
            }}
          >
            MLA100: Vision Language Model
          </Typography>
        </Grid>
        <Grid
          container
          direction="row"
          size={"grow"}
          columnSpacing={"40px"}
        >
          <Grid
            container
            width="675px"
          >
            <ActivablePanel
              isActive={imageSrc == null}
              title={"Select Your Image"}
            >
              <ImageSelector
                imageSrc={imageSrc}
                setImageSrc={setImageSrc}
                webcamRef={webcamRef}
                capture={capture}
              />
            </ActivablePanel>
          </Grid>
          <Grid
            container
            size="grow"
          >
            <ActivablePanel
              isActive={imageSrc != null}
              title={"Ask AI"}
            >
              <Chat
                imageSrc={imageSrc}
                isAnswering={isAnswering}
                question={question}
                setQuestion={setQuestion}
                dialog={dialog}
                tasksNum={tasksNum}
                recentAnswer={recentAnswer}
                ask={ask}
                abort={abort}
                reset={reset}
              />
            </ActivablePanel>
          </Grid>
        </Grid>
      </Grid>
    </ThemeProvider>
  );
}