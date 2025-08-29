import { CircularProgress, Typography, Grid } from '@mui/material';
import ReactMarkdown from "react-markdown"

export default function Answer({
  answer,
  tasksNum,
  isAnswering,
}: {
  answer: string | null,
  tasksNum: number,
  isAnswering: boolean,
}) {
  return (
    <Grid
      container
      direction="row"
      wrap="nowrap"
    >
      <Grid
        container
        justifyContent="center"
        alignItems="center"
        sx={{
          width: "35px",
          height: "35px",
          marginRight: "20px",
          borderRadius: "17.5px",
          backgroundColor: "#006BEF",
        }}
      >
        <svg width="18.53" height="12.35" viewBox="0 0 18 11" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.17187 10.7614C0.990883 10.6023 0.900391 10.3786 0.900391 10.0956V1.30029C0.900391 1.0229 0.996313 0.804677 1.18816 0.643786C1.38 0.484745 1.6008 0.403376 1.85056 0.403376C2.10032 0.403376 2.32113 0.477348 2.51297 0.627143C2.70481 0.776937 2.80074 0.982211 2.80074 1.24481V2.23605C3.09936 1.58139 3.54459 1.08022 4.13641 0.727006C4.72823 0.375636 5.4015 0.199951 6.15983 0.199951C7.02132 0.199951 7.75612 0.414471 8.36061 0.845362C8.9651 1.27625 9.37594 1.88838 9.59131 2.68358C9.88269 1.85879 10.3496 1.23927 10.9885 0.82317C11.6292 0.407074 12.4074 0.199951 13.325 0.199951C13.8535 0.199951 14.3404 0.277622 14.7856 0.434814C15.2308 0.592005 15.629 0.826869 15.9801 1.1431C16.3312 1.45933 16.6063 1.88468 16.8036 2.41728C17.0027 2.94988 17.1004 3.5657 17.1004 4.26105V10.0919C17.1004 10.3767 17.0045 10.5987 16.8126 10.7577C16.6208 10.9167 16.3964 10.9981 16.1394 10.9981C15.8824 10.9981 15.6634 10.9186 15.4824 10.7577C15.3014 10.5987 15.2109 10.3749 15.2109 10.0919V4.18523C15.2109 3.30495 15.0118 2.63735 14.6155 2.18612C14.2191 1.73488 13.6562 1.50927 12.9251 1.50927C12.0563 1.50927 11.3396 1.80146 10.775 2.38399C10.2121 2.96653 9.92975 3.81906 9.92975 4.94344V10.0827C9.92975 10.3675 9.83564 10.5913 9.64741 10.754C9.45919 10.9167 9.23658 11 8.97958 11C8.72258 11 8.51083 10.9186 8.32803 10.754C8.14343 10.5913 8.05112 10.3675 8.05112 10.0827V4.45338C8.05112 2.49125 7.29279 1.51112 5.77614 1.51112C4.87121 1.51112 4.14908 1.80885 3.60612 2.40064C3.06317 2.99427 2.79169 3.82461 2.79169 4.88981V10.0919C2.79169 10.3767 2.69577 10.5987 2.50392 10.7577C2.31208 10.9167 2.08403 10.9981 1.8198 10.9981C1.55556 10.9981 1.3438 10.9186 1.16282 10.7577L1.17187 10.7614Z" fill="white"/>
        </svg>
      </Grid>
      <Grid container size="grow">
      {answer == null || answer == "" ?
        <CircularProgress size={34} /> :
        <Grid
          container
          direction="column"
          alignItems="flex-start"
          sx={{
            fontWeight: 400,
            fontSize: "18px",
            lineHeight: "170%",
            letterSpacing: "-0.2px",
            verticalAlign: "middle",
            color: "#FFFFFF",
            "& *:first-of-type": {
              marginTop: 0,
            },
            "& *:last-of-type": {
              marginBottom: 0,
            }
          }}
        >
          <ReactMarkdown>
            {answer + (isAnswering ? " ..." : "")}
          </ReactMarkdown>
        </Grid>
      }{(answer == null || answer == "") && tasksNum > 0 &&
        <Typography variant='caption' sx={{ml: 2}}>
          Waiting for available device... ({tasksNum} {tasksNum == 1 ? "task" : "tasks"} waiting)
        </Typography>
      }
      </Grid>
    </Grid>
  );
}