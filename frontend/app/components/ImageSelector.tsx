import { Box, Button, Grid2, Typography } from "@mui/material";
import { RefObject } from "react";
import Webcam from "react-webcam";
import { getLanguageTexts, images } from "../settings";
import Image from "next/image";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import { imageUrlToBase64 } from "../utils";

export default function ImageSelector({
  language,
  imageSrc,
  webcamRef,
  setImageSrc,
  capture,
  disabled = false,
}: {
  language: string;
  imageSrc: string | null;
  webcamRef: RefObject<Webcam | null>;
  setImageSrc: (newImageSrc: string | null) => void;
  capture: () => void;
  disabled?: boolean;
}) {
  const texts = getLanguageTexts(language);

  return (
    <Grid2 container padding={"28px"} size={12} direction="column" rowSpacing={"20px"}>
      <Grid2
        container
        size="grow"
        justifyContent={"center"}
        alignContent={"center"}
        sx={{
          position: "relative",
          borderRadius: "10px",
          overflow: "hidden",
          backgroundColor: "#181818",
          minHeight: 360,
        }}
      >
        {!imageSrc && (
          <Grid2 container justifyContent={"center"} alignItems={"center"} sx={{ minHeight: "100%" }}>
            <Webcam
              ref={webcamRef as RefObject<Webcam>}
              audio={false}
              disablePictureInPicture
              imageSmoothing
              mirrored
              screenshotFormat="image/jpeg"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Grid2>
        )}

        {imageSrc && (
          <Box
            component="img"
            src={imageSrc}
            alt="Selected or captured"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {!imageSrc && (
          <Grid2
            container
            columnSpacing={"12px"}
            alignItems={"center"}
            sx={{
              position: "absolute",
              top: "20px",
              left: "20px",
              backgroundColor: "#111111CC",
              borderRadius: "31px",
              padding: "8px 20px",
            }}
          >
            <Box
              sx={{
                width: "11px",
                height: "11px",
                borderRadius: "11px",
                backgroundColor: "#E70000",
                mr: "10px",
              }}
            />
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: "20px",
                lineHeight: "130%",
                letterSpacing: "-0.2px",
                color: "#FFFFFF",
              }}
            >
              {texts.liveCam}
            </Typography>
          </Grid2>
        )}

        {!imageSrc && <Grid2
          container
          rowSpacing={"10px"}
          direction={"column"}
          justifyContent={"center"}
          alignItems={"center"}
          sx={{ position: "absolute", bottom: "29.29px" }}
        >
          <Button
            variant="contained"
            disableElevation
            disabled={disabled}
            sx={{
              backgroundColor: "#0073FF",
              borderRadius: "29px",
              textTransform: "none",
              padding: "7px 24px",
              fontWeight: 500,
              fontSize: "22px",
              lineHeight: "130%",
              letterSpacing: "-0.2px",
              color: "#FFFFFF",
              "&.Mui-disabled": {
                color: "#7C7C7E",
                backgroundColor: "#111111",
              },
            }}
            onClick={capture}
          >
            <CameraAltOutlinedIcon sx={{ marginRight: "12px" }} />
            {texts.screenshot}
          </Button>
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: "16px",
              lineHeight: "130%",
              letterSpacing: "-0.18px",
              color: imageSrc != null ? "#535353" : "#ADADAD",
            }}
          >
            {texts.galleryHint}
          </Typography>
        </Grid2>

        }
      </Grid2>

      <Grid2
        container
        padding={"21px 23px"}
        direction="column"
        rowSpacing={"28px"}
        sx={{ borderRadius: "20px", backgroundColor: "#181818" }}
      >
        <Typography
          sx={{
            fontWeight: 500,
            fontSize: "20px",
            lineHeight: "130%",
            letterSpacing: "-0.18px",
            color: "#B8B8B8",
          }}
        >
          {texts.galleryTitle}
        </Typography>

        <Grid2 container justifyContent={"space-between"}>
          {images.map((image) => (
            <Button
              key={image}
              disabled={disabled}
              sx={{
                position: "relative",
                p: 0,
                width: "125px",
                height: "125px",
                borderRadius: "10px",
                border: "1px solid #4D4D4D",
                overflow: "hidden",
                opacity: disabled ? 0.5 : 1,
                "&:hover": { border: "2px solid #0D6BDF" },
              }}
              onClick={
                disabled
                  ? undefined
                  : async () => setImageSrc(await imageUrlToBase64(`/images/${image}`))
              }
            >
              <Image
                src={`/images/${image}`}
                alt={image}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                style={{ objectFit: "cover" }}
              />
            </Button>
          ))}
        </Grid2>
      </Grid2>
    </Grid2>
  );
}
