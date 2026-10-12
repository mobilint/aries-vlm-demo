"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import {
  Typography,
  Grid2,
  Button,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import ActivablePanel from "./components/ActivablePanel";
import ImageSelector from "./components/ImageSelector";
import Webcam from "react-webcam";
import Chat from "./components/Chat";
import LanguageSwitcher from "./components/LanguageSwitcher";
import VlmSelector from "./components/VlmSelector";
import { defaultLLMClient, LLMClient, LLMState } from "./components/type";
import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  example_questions_by_language,
  getLanguageTexts,
  INACTIVITY_TIMEOUT_MS,
  loadPromptBundle,
} from "./settings";
import { useDebounce } from "react-simplikit";
import { imageUrlToBase64 } from "./utils";

const theme = createTheme({
  typography: {
    fontFamily: "Pretendard",
  },
});

// Keep a finished answer on screen at least this long before auto mode
// asks the next example question.
const MIN_ANSWER_DISPLAY_MS = 1000;

export default function Page() {
  const socket = useRef<Socket | null>(null);
  const webcamRef = useRef<Webcam | null>(null);
  const languageRef = useRef(DEFAULT_LANGUAGE);
  const exampleIndexRef = useRef(0);
  const lastAnswerEndAtRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState<LLMClient>(defaultLLMClient);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [isExampleMode, setIsExampleMode] = useState<boolean>(true);
  const [exampleIndex, setExampleIndex] = useState<number>(0);
  const [isPromptConfigReady, setIsPromptConfigReady] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isModelSwitching, setIsModelSwitching] = useState(false);

  const texts = getLanguageTexts(language);
  const debouncedSetIsExampleMode = useDebounce(() => setIsExampleMode(true), INACTIVITY_TIMEOUT_MS);

  const ask = useCallback((newQuestion: string, image: string | null) => {
    if (socket.current == null || newQuestion == "" || !isPromptConfigReady)
      return;

    setClient((client) => {
      const newDialog = [...client.dialog];
      newDialog.push({ question: newQuestion, answer: null });

      return {
        ...client,
        dialog: newDialog,
        state: LLMState.ASKING,
      };
    });

    socket.current.emit("ask", newQuestion, image);
  }, [isPromptConfigReady]);

  const reset = useCallback(() => {
    if (socket.current == null)
      return;

    setClient((client) => ({
      ...client,
      image: null,
      dialog: [],
      recentAnswer: null,
      state: LLMState.IDLE,
    }));

    socket.current.emit("reset");
  }, []);

  const setImage = useCallback((imageSrc: string | null) => {
    setClient((client) => ({ ...client, image: imageSrc }));
  }, []);

  // Pick a (new) image outside auto mode: leave example mode, clear the
  // previous conversation/session, and start fresh on the chosen image.
  // Lets the user select an image again after stopping generation.
  const selectImage = useCallback((imageSrc: string | null) => {
    setIsExampleMode(false);
    socket.current?.emit("reset");
    setClient((client) => ({
      ...client,
      image: imageSrc,
      dialog: [],
      recentAnswer: null,
      state: LLMState.IDLE,
    }));
  }, []);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    exampleIndexRef.current = exampleIndex;
  }, [exampleIndex]);

  useEffect(() => {
    if (client.model_id == "" || !isPromptConfigReady)
      return;

    const examples = example_questions_by_language[language] ?? example_questions_by_language[DEFAULT_LANGUAGE] ?? [];

    if (examples.length == 0)
      return;

    async function askQuestion() {
      const currentExample = examples[exampleIndexRef.current % examples.length];
      setExampleIndex((cur) => (cur + 1) % examples.length);
      reset();
      const imageSrc = await imageUrlToBase64(`/images/${currentExample.image}`);
      setImage(imageSrc);
      ask(currentExample.question, imageSrc);
    }

    if (isExampleMode && client.state == LLMState.IDLE) {
      const wait = Math.max(0, MIN_ANSWER_DISPLAY_MS - (Date.now() - lastAnswerEndAtRef.current));
      const timer = setTimeout(askQuestion, wait);
      return () => clearTimeout(timer);
    } else {
      debouncedSetIsExampleMode();
    }
  }, [ask, client.model_id, client.state, debouncedSetIsExampleMode, isExampleMode, isPromptConfigReady, language, reset, setImage]);

  function onConnect() {
    setIsConnected(true);
    setIsPromptConfigReady(false);
    socket.current?.emit("vlm_models:get");
  }

  function onDisconnect() {
    setIsConnected(false);
    setIsPromptConfigReady(false);
  }

  function onModel(model: string) {
    setExampleIndex(0);
    setClient({ ...defaultLLMClient, model_id: model, language: languageRef.current });
  }

  function onVlmModelState(payload: { available_models?: string[]; is_switching?: boolean }) {
    if (Array.isArray(payload.available_models))
      setAvailableModels(payload.available_models);
    setIsModelSwitching(Boolean(payload.is_switching));
  }

  const changeModel = useCallback((modelId: string) => {
    if (socket.current == null || modelId == "") return;
    setIsModelSwitching(true);
    socket.current.emit("vlm_model:set", { model_id: modelId });
  }, []);

  function onTasks(tasks: number) {
    setClient((client) => ({ ...client, tasksNum: tasks }));
  }

  function onStart() {
    setClient((client) => ({ ...client, state: LLMState.ANSWERING }));
  }

  function onToken(token: string) {
    setClient((client) => {
      if (client.state == LLMState.IDLE || client.dialog.length == 0)
        return client;

      return {
        ...client,
        recentAnswer: client.recentAnswer == null ? token : client.recentAnswer + token,
      };
    });
  }

  function onEnd(isAborted: boolean) {
    lastAnswerEndAtRef.current = Date.now();
    setClient((client) => {
      if (client.state == LLMState.IDLE || client.dialog.length == 0)
        return client;

      const newDialog = [...client.dialog];
      const recentAnswer = client.recentAnswer ?? "";
      newDialog[newDialog.length - 1].answer = recentAnswer + (isAborted ? " [ABORTED]" : "");

      return {
        ...client,
        dialog: newDialog,
        state: LLMState.IDLE,
        recentAnswer: null,
      };
    });
  }

  function onPromptConfigState(payload: { is_ready: boolean }) {
    setIsPromptConfigReady(payload.is_ready);
  }

  function onPromptConfigSaved() {
    setIsPromptConfigReady(true);
  }

  useEffect(() => {
    socket.current = io(`${window.location.protocol == "https:" ? "wss" : "ws"}://${window.location.hostname}:5000`);
    socket.current.on("connect", onConnect);
    socket.current.on("disconnect", onDisconnect);
    socket.current.on("model", onModel);
    socket.current.on("vlm_model_state", onVlmModelState);
    socket.current.on("tasks", onTasks);
    socket.current.on("start", onStart);
    socket.current.on("token", onToken);
    socket.current.on("end", onEnd);
    socket.current.on("prompt_config_state", onPromptConfigState);
    socket.current.on("prompt_config_saved", onPromptConfigSaved);

    return () => {
      if (socket.current) {
        socket.current.disconnect();
        socket.current.off("connect", onConnect);
        socket.current.off("disconnect", onDisconnect);
        socket.current.off("model", onModel);
        socket.current.off("vlm_model_state", onVlmModelState);
        socket.current.off("tasks", onTasks);
        socket.current.off("start", onStart);
        socket.current.off("token", onToken);
        socket.current.off("end", onEnd);
        socket.current.off("prompt_config_state", onPromptConfigState);
        socket.current.off("prompt_config_saved", onPromptConfigSaved);
      }
    };
  }, []);

  useEffect(() => {
    if (!isConnected || socket.current == null)
      return;

    async function syncPromptBundle() {
      setIsPromptConfigReady(false);
      const promptBundle = await loadPromptBundle(language);
      socket.current?.emit("prompt_config", promptBundle);
    }

    syncPromptBundle();
  }, [isConnected, language]);

  function abort() {
    socket.current?.emit("abort");
  }

  function capture() {
    if (socket.current == null || webcamRef.current == null)
      return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc == null)
      return;

    selectImage(imageSrc);
  }

  function changeLanguage(nextLanguage: string) {
    if (nextLanguage == language)
      return;

    setExampleIndex(0);
    setIsExampleMode(false);
    reset();
    setLanguage(nextLanguage);
  }

  function enableAutoMode() {
    setExampleIndex(0);
    exampleIndexRef.current = 0;
    setIsExampleMode(true);
    reset();
  }

  if (isConnected == false) {
    return (
      <ThemeProvider theme={theme}>
        <Grid2
          container
          justifyContent="center"
          alignItems="center"
          sx={{ width: "100vw", height: "100vh", backgroundColor: "#111111" }}
        >
          <Typography sx={{ color: "#FFFFFF", fontSize: "24px", fontWeight: 500 }}>
            {texts.statusConnecting}
          </Typography>
        </Grid2>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Grid2
        container
        direction="column"
        wrap="nowrap"
        rowSpacing={"24px"}
        sx={{
          width: "100vw",
          height: "100vh",
          padding: "40px 40px 24px",
        }}
      >
        <Grid2
          container
          justifyContent="space-between"
          alignItems={"center"}
        >
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "48px",
              lineHeight: "130%",
              letterSpacing: "-0.2px",
              verticalAlign: "middle",
              color: "#FFFFFF",
            }}
          >
            {texts.appTitle}
          </Typography>
          <Grid2 container alignItems="center" columnSpacing="12px" sx={{ width: "fit-content" }}>
            <Button
              disableElevation
              disabled={client.state != LLMState.IDLE || !isPromptConfigReady}
              onClick={enableAutoMode}
              sx={{
                minWidth: "auto",
                height: "46px",
                padding: "0 18px",
                borderRadius: "999px",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "15px",
                color: isExampleMode ? "#FFFFFF" : "#0B4EA2",
                backgroundColor: isExampleMode ? "#0B4EA2" : "#FFFFFF",
                border: isExampleMode ? "1px solid transparent" : "1px solid #D7DFEF",
                boxShadow: "0 10px 30px rgba(13, 35, 67, 0.08)",
                "&:hover": {
                  backgroundColor: isExampleMode ? "#0B4EA2" : "#F4F8FD",
                },
                "&.Mui-disabled": {
                  color: isExampleMode ? "#FFFFFF" : "#8EA1B8",
                  backgroundColor: isExampleMode ? "#7C96B8" : "#F5F7FA",
                  borderColor: "#E2E8F0",
                },
              }}
            >
              {texts.autoLabel}
            </Button>
            <VlmSelector
              models={availableModels}
              currentModel={client.model_id}
              disabled={client.state != LLMState.IDLE || isModelSwitching}
              isSwitching={isModelSwitching}
              changeModel={changeModel}
            />
            <LanguageSwitcher
              languages={[...AVAILABLE_LANGUAGES]}
              currentLanguage={language}
              disabled={client.state != LLMState.IDLE || isModelSwitching}
              changeLanguage={changeLanguage}
            />
          </Grid2>
        </Grid2>
        <Grid2
          container
          direction="row"
          size={"grow"}
          columnSpacing={"40px"}
        >
          <Grid2
            container
            width="675px"
          >
            <ActivablePanel
              isActive={client.image == null}
              title={texts.imagePanelTitle}
            >
              <ImageSelector
                language={language}
                imageSrc={client.image}
                setImageSrc={selectImage}
                webcamRef={webcamRef}
                capture={capture}
                disabled={client.state != LLMState.IDLE || isModelSwitching}
              />
            </ActivablePanel>
          </Grid2>
          <Grid2
            container
            size="grow"
          >
            <ActivablePanel
              isActive={client.image != null}
              title={texts.chatPanelTitle}
            >
              <Chat
                client={client}
                language={language}
                ask={(question: string) => { setIsExampleMode(false); ask(question, client.dialog.length > 0 ? null : client.image); }}
                abort={() => { setIsExampleMode(false); abort(); }}
                reset={() => { setIsExampleMode(false); reset(); }}
              />
            </ActivablePanel>
          </Grid2>
        </Grid2>
        {!isPromptConfigReady &&
          <Typography
            sx={{
              color: "#A8A8A8",
              fontSize: "14px",
              lineHeight: "130%",
            }}
          >
            {texts.statusPreparingPromptBundle}
          </Typography>
        }
      </Grid2>
    </ThemeProvider>
  );
}
