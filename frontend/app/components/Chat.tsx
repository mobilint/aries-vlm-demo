import { Grid } from "@mui/material";
import { DialogType } from "./type";
import { useEffect, useRef } from "react";
import ChatInput from "./ChatInput";
import Dialog from "./Dialog";
import { Stop, Send } from "@mui/icons-material";

export default function Chat({
  imageSrc,
  isAnswering,
  question,
  setQuestion,
  dialog,
  tasksNum,
  recentAnswer,
  ask,
  abort,
  reset,
}: {
  imageSrc: string | null,
  isAnswering: boolean,
  question: string,
  setQuestion: (question: string) => void,
  dialog: DialogType,
  tasksNum: number,
  recentAnswer: string | null,
  ask: (question: string) => void,
  abort: () => void,
  reset: () => void,
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollGridRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    if (isAnswering == false)
      inputRef.current?.focus();
  }, [isAnswering]);
  
  return (
    <Grid
      container
      size={12}
      justifyContent={"center"}
      padding={"28px"}
    >
      <Grid
        container
        size={12}
        direction="column"
        alignItems="stretch"
        maxWidth={"880px"}
        rowSpacing={"28px"}
      >
        <Grid
          container
          size="grow"
          direction="column"
          wrap="nowrap"
          alignItems="stretch"
          ref={scrollGridRef}
          sx={{
            overflowY: "scroll",
          }}
        >
          <Dialog
            dialog={dialog}
            tasksNum={tasksNum}
            isAnswering={isAnswering}
            recentAnswer={recentAnswer}
            scrollGridRef={scrollGridRef}
          />
        </Grid>
        <Grid>
          <ChatInput
            inputDisabled={imageSrc == null || isAnswering}
            buttonDisabled={imageSrc == null}
            showImage={dialog.length == 0}
            imageSrc={imageSrc}
            value={question}
            onChange={setQuestion}
            inputRef={inputRef}
            buttonIcon={isAnswering ? <Stop /> : <Send />}
            onButtonPressed={() => isAnswering ? abort() : ask(question)}
            reset={reset}
          />
        </Grid>
      </Grid>
    </Grid>
  )
}