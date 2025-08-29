import { FormControl, Input, IconButton, Grid, Button } from "@mui/material";
import { RefObject } from "react";
import Image from 'next/image';
import CachedIcon from '@mui/icons-material/Cached'

export default function ChatInput({
  inputDisabled,
  buttonDisabled,
  showImage,
  imageSrc,
  value,
  onChange,
  inputRef,
  buttonIcon,
  onButtonPressed,
  reset,
}: {
  inputDisabled: boolean,
  buttonDisabled: boolean,
  showImage: boolean,
  imageSrc: string | null,
  value: string,
  onChange: (value: string) => void,
  inputRef: RefObject<HTMLInputElement | null>,
  buttonIcon: React.ReactNode,
  onButtonPressed: () => void,
  reset: () => void,
}) {
  return (
    <FormControl
      fullWidth
      variant="standard"
      sx={{
        backgroundColor: buttonDisabled ? "#393939 !important" : "#F3F3F3 !important",
        borderRadius: "20px",
        padding: "25px",
      }}
    >
      <Grid
        container
        direction="column"
        rowSpacing="10px"
      >
      {imageSrc && showImage &&
        <Image
          src={imageSrc}
          alt="Selected image"
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
          disabled={inputDisabled}
          placeholder="e.g. How many people are in the image?"
          value={value}
          onChange={e => onChange(e.target.value)}
          disableUnderline
          multiline
          maxRows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !inputDisabled) {
              e.preventDefault();
              onButtonPressed();
            }
          }}

          sx={{
            padding: 0,
            alignSelf: "stretch",

            fontWeight: 400,
            fontSize: "18px",
            lineHeight: "170%",
            letterSpacing: "-0.2px",
            verticalAlign: "middle",
            backgroundColor: "transparent",
            
            color: "#000000",
            "& ::placeholder": {
              color: "#6E6E6E",
            },
            "& .Mui-disabled::placeholder": {
              color: "#6E6E6E",
              opacity: 1,
              WebkitTextFillColor: "#6E6E6E",
            },
          }}

          inputProps={{
            maxLength: 500,
          }}
        />
        <Grid
          container
          justifyContent={imageSrc == null ? "flex-end" : "space-between"}
          alignItems={"flex-end"}
        >
          <Button
            variant="contained"
            disableElevation
            disabled={inputDisabled}
            onClick={reset}
            startIcon={<CachedIcon />}
            sx={{
              display: imageSrc == null ? "none" : undefined,
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
            Reset
          </Button>
          <IconButton
            disabled={buttonDisabled}
            onClick={() => onButtonPressed()}
            sx={{
              width: "45px",
              height: "45px",
              alignSelf: "flex-end",
              backgroundColor: value != "" ? "#383a3bff !important" : "#D8DADE !important",
              color: value != "" ? "#FFFFFF" : "#000000",
              ":hover": {
                backgroundColor: "#006BEF !important",
                color: "#FFFFFF !important"
              },
              "&.Mui-disabled": {
                backgroundColor: "#626262 !important",
                color: "#B8B8B8 !important"
              },
            }}
          >
            {buttonIcon}
          </IconButton>
        </Grid>
      </Grid>
    </FormControl>
  );
}