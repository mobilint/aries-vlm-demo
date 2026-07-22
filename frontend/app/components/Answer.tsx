import { CircularProgress, Typography } from '@mui/material';
import Grid2 from "@mui/material/Grid2"
import { Fragment } from 'react';
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from 'rehype-highlight'
import { LLMClient } from './type';
import ModelIcon from './ModelIcon';

export default function Answer({
  client,
  answer,
  isAnswering,
  isReasoningModel,
}: {
  client: LLMClient,
  answer: string | null,
  isAnswering: boolean,
  isReasoningModel: boolean,
}) {
  const thought_and_answer = !!answer && (isReasoningModel ? answer.split("</thought>") : ["", answer]);
  const thought = thought_and_answer && thought_and_answer[0];
  const real_answer = thought_and_answer && thought_and_answer[1];

  return (
    <Grid2
      container
      columnSpacing="20px"
      direction="row"
      wrap="nowrap"
      alignItems={thought_and_answer ? "flex-start" : "center"}
    >
      <Grid2
        container
        justifyContent="center"
        alignItems="center"
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "55px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #AAB8C2",
        }}
      >
        <ModelIcon
          model_id={client.model_id}
          width="22px"
        />
      </Grid2>
      <Grid2
        container
        size="grow"
        alignItems={thought_and_answer ? "flex-start" : "center"}
        sx={{
          fontFamily: "Pretendard",
          color: "white",
          fontSize: "20px",
          lineHeight: "170%",
          letterSpacing: "-0.3px",
          "& pre, & code": { fontFamily: "CascadiaCode" },
        }}
      >
      {thought_and_answer ?
        <Fragment>
        {thought &&
          <Grid2
            container
            direction="column"
            alignItems="flex-start"
            sx={{
              color: "#7C7C7E",
              "& > *:first-of-type": { marginTop: 0 },
              "& > *:last-of-type": { marginBottom: 0 },
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
            >
              {thought + (isAnswering && !!answer == false ? " ..." : "")}
            </ReactMarkdown>
          </Grid2>
        }{real_answer &&
          <Grid2
            container
            direction="column"
            alignItems="flex-start"
            sx={{
              "& > *:first-of-type": { marginTop: 0 },
              "& > *:last-of-type": { marginBottom: 0 },
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
            >
              {real_answer + (isAnswering ? " ..." : "")}
            </ReactMarkdown>
          </Grid2>
        }
        </Fragment> :
      isAnswering ?
        <Fragment>
          <CircularProgress size={38} />
        {client.tasksNum > 0 &&
          <Typography variant='caption'>
            Waiting for available device... ({client.tasksNum} {client.tasksNum == 1 ? "task" : "tasks"} waiting)
          </Typography>
        }
        </Fragment> :
        <Typography variant='caption' sx={{color: "#7C7C7E"}}>[Aborted]</Typography>
      }
      </Grid2>
    </Grid2>
  );
}