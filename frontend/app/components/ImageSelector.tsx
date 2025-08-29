import { Box, Button, Grid, Typography } from "@mui/material";
import { RefObject } from "react";
import Webcam from "react-webcam";
import images from "../../images";
import Image from "next/image";
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import CachedIcon from '@mui/icons-material/Cached';

async function imageUrlToBase64(url: string) : Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ImageSelector({
  imageSrc,
  webcamRef,
  setImageSrc,
  capture,
}: {
  imageSrc: string | null,
  webcamRef: RefObject<Webcam | null>,
  setImageSrc: (newImageSrc: string | null) => void,
  capture: () => void,
}) {
  return (
    <Grid
      container
      padding={"28px"}
      size={12}
      direction="column"
      rowSpacing={"20px"}
    >
      <Grid
        container
        size="grow"
        justifyContent={"center"}
        alignContent={"center"}
        sx={{
          position: "relative",
          borderRadius: "10px",
          overflow: "hidden",
          backgroundColor: imageSrc != null ? "#181818" : undefined,
        }}
      >
        <Grid
          container
          justifyContent={"center"}
          alignItems={"center"}
          sx={{
            display: imageSrc != null ? "none" : undefined,
            minHeight: "100%",
          }}
        >
          <Webcam
            ref={webcamRef}
            audio={false}
            height={"100%"}
            disablePictureInPicture
            imageSmoothing
            style={{
              display: imageSrc != null ? "hidden" : undefined
            }}
          />
        </Grid>
      {imageSrc == null &&
        <Grid
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
            }}
          />
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: "20px",
              lineHeight: "130%",
              letterSpacing: "-0.2px",
              verticalAlign: "middle",
              color: "#FFFFFF",
            }}
          >
            Live Cam
          </Typography>
        </Grid>
      }{imageSrc != null &&
        <Grid
          container
          direction="column"
          alignItems={"center"}
          rowSpacing={"27px"}
          sx={{
            paddingBottom: "33px",
          }}
        >
          <CachedIcon
            fontSize="large"
            sx={{
              color: "#ADADAD",
            }}
          />
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: "24px",
              lineHeight: "130%",
              letterSpacing: "-0.18px",
              verticalAlign: "middle",
              color: "#ADADAD",
              textAlign: "center",
            }}
          >
            If you want to start over,
            <br />
            please click the reset button in chat.
          </Typography>
        </Grid>
      }
        <Grid
          container
          rowSpacing={"10px"}
          direction={"column"}
          justifyContent={"center"}
          alignItems={"center"}
          sx={{
            position: "absolute",
            bottom: "29.29px",
          }}
        >
          <Button
            variant="contained"
            disableElevation
            disabled={imageSrc != null}
            sx={{
              backgroundColor: "#0073FF",
              borderRadius: "29px",
              textTransform: "none",
              padding: "7px 24px",
              fontWeight: 500,
              fontSize: "22px",
              lineHeight: "130%",
              letterSpacing: "-0.2px",
              verticalAlign: "middle",
              color: "#FFFFFF",
              "&.Mui-disabled": {
                color: "#7C7C7E",
                backgroundColor: "#111111",
              }
            }}
            onClick={capture}
          >
            <CameraAltOutlinedIcon sx={{marginRight: "12px"}} />
            Screenshot
          </Button>
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: "16px",
              lineHeight: "130%",
              letterSpacing: "-0.18px",
              verticalAlign: "middle",
              color: imageSrc != null ? "#535353" : "#ADADAD",
            }}
          >
            Or pick an image from the gallery
          </Typography>
        </Grid>
      </Grid>
      <Grid
        container
        padding={"21px 23px"}
        direction="column"
        rowSpacing={"28px"}
        sx={{
          borderRadius: "20px",
          backgroundColor: "#181818",
        }}
      >
        <Typography
          sx={{
            fontWeight: 500,
            fontSize: "20px",
            lineHeight: "130%",
            letterSpacing: "-0.18px",
            verticalAlign: "middle",
            color: "#B8B8B8",
          }}
        >
          Gallery
        </Typography>
        <Grid
          container
          justifyContent={"space-between"}
        >
        {images.map((image) => (
          <Button
            key={image}
            disabled={imageSrc != null}
            sx={{
              position: "relative",
              padding: "0px",
              width: "125px",
              height: "125px",
              borderRadius: "10px",
              border: "1px solid #4D4D4D",
              overflow: "hidden",
              "&:hover": {
                border: "2px solid #0D6BDF",
              },
            }}
            onClick={imageSrc == null ? (async () => setImageSrc(await imageUrlToBase64(`/images/${image}`))) : undefined}
          >
            <Image
              src={`/images/${image}`}
              alt={image}
              fill
              sizes="125px 125px"
              style={{
                objectFit: "cover",
              }}
            />
          </Button>
        ))}
        </Grid>
      </Grid>
    </Grid>
  )
}