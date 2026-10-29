import { FormControl, Input, IconButton, Grid2, Button } from "@mui/material";
import { RefObject, useState } from "react";
import { LLMClient, LLMState } from "./type";
import { Stop, ArrowUpward, Cached } from "@mui/icons-material";
import Image from "next/image";
import { getLanguageTexts } from "../settings";

export default function ChatInput({
  client,
  language,
  ask,
  abort,
  reset,
  inputRef,
}: {
  client: LLMClient,
  language: string,
  ask: (question: string) => void,
  abort: () => void,
  reset: () => void,
  inputRef: RefObject<HTMLInputElement | null>,
}) {
  const [value, setValue] = useState<string>("");
  const texts = getLanguageTexts(language);

  const handleClick = () => {
    if (client.state != LLMState.IDLE)
      abort();
    else {
      ask(value);
      setValue("");
    }
  }

  return (
    <FormControl
      fullWidth
      variant="standard"
      sx={{
        backgroundColor: client.image == null ? "#393939 !important" : "#F3F3F3 !important",
        borderRadius: "20px",
        padding: "25px",
      }}
    >
      <Grid2
        container
        direction="column"
        rowSpacing="10px"
      >
      {client.dialog.length == 0 && client.image &&
        <Image
          src={client.image}
          alt={texts.imagePanelTitle}
          width={85}
          height={85}
          style={{
            borderRadius: "10px",
            objectFit: "cover",
          }}
        />
      }
        <Input
          id="chat"
          ref={inputRef}
          disabled={client.image == null || client.state != LLMState.IDLE}
          placeholder={texts.inputPlaceholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          disableUnderline
          multiline
          maxRows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && client.image != null && client.state == LLMState.IDLE && !e.shiftKey) {
              e.preventDefault();
              ask(value);
              setValue("");
            }
          }}

          sx={{
            padding: 0,
            alignSelf: "stretch",

            fontWeight: 400,
            fontSize: "20px",
            lineHeight: "170%",
            letterSpacing: "-0.3px",
            textAlign: "left",
            verticalAlign: "middle",
            backgroundColor: "transparent !important",
            
            color: "#000000",
            "& ::placeholder": {
              color: "#7A7B7E",
            },
            "& .Mui-disabled::placeholder": {
              color: "#7A7B7E",
              opacity: 1,
              WebkitTextFillColor: "#7A7B7E",
            },
          }}

          inputProps={{
            maxLength: 500,
          }}
        />
        <Grid2
          container
          justifyContent={client.image == null ? "flex-end" : "space-between"}
          alignItems={"flex-end"}
        >
          <Button
            variant="contained"
            disableElevation
            disabled={client.image == null || client.state != LLMState.IDLE}
            onClick={reset}
            startIcon={<Cached />}
            sx={{
              display: client.image == null ? "none" : undefined,
              fontWeight: 500,
              fontSize: '16px',
              lineHeight: "130%",
              letterSpacing: "-0.2px",
              verticalAlign: "middle",
              color: "#292929",
              textTransform: "none",
              borderRadius: "50px",
              border: "1px solid #D8D5D5",
              backgroundColor: "transparent",
              padding: "7px 11px",
              "&.Mui-disabled": {
                backgroundColor: "#E1E1E1",
                color: "#292929",
                border: "0px",
              },
              ":hover": {
                border: "1px solid #006BEF",
                color: "#006BEF",
              },
              "& .MuiButton-startIcon": {
                marginLeft: "0px",
                marginRight: "12px",
              },
            }}
          >
            {texts.reset}
          </Button>
          <IconButton
            onClick={handleClick}
            sx={{
              width: "48px",
              height: "48px",
              alignSelf: "flex-end",
              backgroundColor: value != "" ? "#383a3bff !important" : "#D8DADE !important",
              color: value != "" ? "#FFFFFF" : "#000000",
              ":hover": {
                backgroundColor: "#0072FF !important",
                color: "#FFFFFF !important"
              },
              "&.Mui-disabled": {
                backgroundColor: "#626262 !important",
                color: "#B8B8B8 !important"
              },
            }}
          >
          {client.state != LLMState.IDLE ?
            <Stop /> :
            <ArrowUpward fontSize="large" />
          }
          </IconButton>
        </Grid2>
      </Grid2>
    </FormControl>
  );
}
