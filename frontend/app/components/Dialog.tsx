import { Grid2, Typography } from "@mui/material";
import { Fragment, MutableRefObject, useCallback, useEffect, useRef } from "react";
import Answer from "./Answer";
import { LLMClient, LLMState } from "./type";
import Image from 'next/image';
import { getLanguageTexts } from "../settings";

export default function Dialog({
  client,
  language,
  scrollGridRef,
}: {
  client: LLMClient,
  language: string,
  scrollGridRef: MutableRefObject<HTMLDivElement | null>,
}) {
  const isReasoningModel = [
    "LGAI-EXAONE/EXAONE-Deep-2.4B",
  ].includes(client.model_id);
  const texts = getLanguageTexts(language);

  const bottomDivRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomDivRef.current?.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
  }, []);

  useEffect(() => {
    if (scrollGridRef.current != null) {
      const diff = scrollGridRef.current.scrollHeight - scrollGridRef.current.offsetHeight - scrollGridRef.current.scrollTop;
      if (-100 < diff && diff < 100)
        scrollToBottom();
    }
  }, [client.recentAnswer, scrollGridRef, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [client.dialog.length, scrollToBottom]);

  return (
    <Fragment>
      {client.dialog.map((qna, index) =>
        <Fragment key={`${index}`}>
          <Grid2
            container
            direction="column"
            alignItems="flex-end"
            rowSpacing={"17px"}
          >
          {index == 0 && client.image &&
            <Image
              src={client.image}
              alt={texts.imagePanelTitle}
              width={288}
              height={288}
              style={{
                borderRadius: "20px",
                borderBottomRightRadius: "5px",
                objectFit: "cover",
              }}
            />
          }
            <Typography
              sx={{
                backgroundColor: "#242424",
                padding: "25px",
                borderRadius: "23px",
                borderTopRightRadius: index == 0 && client.image ? "5px" : undefined,
                fontWeight: "regular",
                fontSize: "20px",
                lineHeight: "170%",
                letterSpacing: "-0.3px",
                color: "#F0F0F0",
                maxWidth: "500px",
              }}
            >
              {qna.question}
            </Typography>
          </Grid2>
          {!(client.state != LLMState.IDLE && index == client.dialog.length - 1) &&
            <Answer
              client={client}
              answer={qna.answer}
              isAnswering={false}
              isReasoningModel={isReasoningModel}
            />
          }
        </Fragment>
      )}
      {client.state != LLMState.IDLE &&
        <Answer
          client={client}
          answer={client.recentAnswer}
          isAnswering={true}
          isReasoningModel={isReasoningModel}
        />
      }
      <div ref={bottomDivRef}></div>
    </Fragment>
  );
}
