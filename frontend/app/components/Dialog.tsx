import { Grid, Typography } from "@mui/material";
import { Fragment, RefObject, useEffect, useRef } from "react";
import Answer from "./Answer";
import { QNA } from "./type";
import Image from 'next/image';

export default function Dialog({
  dialog,
  tasksNum,
  isAnswering,
  recentAnswer,
  scrollGridRef,
}: {
  dialog: QNA[],
  tasksNum: number,
  isAnswering: boolean,
  recentAnswer: string | null,
  scrollGridRef: RefObject<HTMLDivElement | null>,
}) {
  const bottomDivRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    bottomDivRef.current?.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" })
  }

  useEffect(() => {
    if (scrollGridRef.current != null) {
      const diff = scrollGridRef.current.scrollHeight - scrollGridRef.current.offsetHeight - scrollGridRef.current.scrollTop;
      if (-100 < diff && diff < 100)
        scrollToBottom();
    }
  }, [recentAnswer, scrollGridRef])

  useEffect(() => {
    scrollToBottom();
  }, [dialog.length])

  return (
    <Fragment>
      {dialog.map((qna, index) =>
        <Fragment key={`${index}`}>
          <Grid
            container
            direction="column"
            alignItems="flex-end"
            rowSpacing={"17px"}
          >
          {qna.image &&
            <Image
              src={qna.image}
              alt="Selected image"
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
                padding: "15px 22px",
                borderRadius: "20px",
                borderTopRightRadius: qna.image ? "5px" : undefined,
                fontWeight: 400,
                fontSize: "18px",
                lineHeight: "170%",
                letterSpacing: "-0.2px",
                verticalAlign: "middle",
                color: "#F0F0F0",
                maxWidth: "500px",
                marginBottom: "55px",
                marginTop: index == 0 ? undefined : "55px",
              }}
            >
              {qna.question}
            </Typography>
          </Grid>
          {!(isAnswering == true && index == dialog.length - 1) &&
            <Answer answer={qna.answer} tasksNum={tasksNum} isAnswering={false} />
          }
        </Fragment>
      )}
      {isAnswering &&
        <Answer answer={recentAnswer} tasksNum={tasksNum} isAnswering={isAnswering} />
      }
      <div ref={bottomDivRef}></div>
    </Fragment>
  );
}