import { Grid2 } from "@mui/material";
import ChatInput from "./ChatInput";
import { useEffect, useRef } from "react";
import { LLMClient, LLMState } from "./type";
import Dialog from "./Dialog";

export default function Chat({
  client,
  language,
  ask,
  abort,
  reset,
}: {
  client: LLMClient,
  language: string,
  ask: (question: string) => void,
  abort: () => void,
  reset: () => void,
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollGridRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    if (client.state == LLMState.IDLE)
      inputRef.current?.focus();
  }, [client.state]);
  
  return (
    <Grid2
      container
      direction="column"
      alignItems="center"
      size="grow"
      sx={{
        padding: "28px",
      }}
    >
      <Grid2
        container
        size="grow"
        direction="column"
        wrap="nowrap"
        justifyContent={client.dialog.length == 0 ? "center" : undefined}
        alignItems="stretch"
        rowSpacing="44px"
        sx={{
          width: "100%",
          maxWidth: "880px",
          overflowY: "scroll",
          margin: "50px 0px",
        }}
        ref={scrollGridRef}
      >
        <Dialog
          client={client}
          language={language}
          scrollGridRef={scrollGridRef}
        />
      </Grid2>
      <Grid2
        sx={{
          width: "100%",
          maxWidth: "880px",
          paddingBottom: "33px",
        }}
      >
        <ChatInput
          client={client}
          language={language}
          inputRef={inputRef}
          ask={ask}
          abort={abort}
          reset={reset}
        />
      </Grid2>
    </Grid2>
  )
}
