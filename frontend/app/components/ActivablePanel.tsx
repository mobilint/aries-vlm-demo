import { Grid, Typography } from "@mui/material";

export default function ActivablePanel({
  children,
  isActive,
  title,
}: Readonly<{
  children?: React.ReactNode,
  isActive: boolean,
  title: string,
}>) {
  return (
    <Grid
      container
      direction="column"
      rowSpacing={"21px"}
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
      <Typography
        sx={{
          fontWeight: 600,
          fontSize: "24px",
          lineHeight: "130%",
          letterSpacing: "-0.2px",
          verticalAlign: "middle",
          color: isActive ? "#0D6BDF" : "#7C7C7E",
        }}
      >
        {title}
      </Typography>
      <Grid
        container
        size={"grow"}
        justifyContent="stretch"
        alignItems="stretch"
        sx={{
          border: "1px solid",
          borderRadius: "20px",
          borderColor: isActive ? "#0073FF" : undefined,
          backgroundColor: isActive ? undefined : "#242424",
        }}
      >
        {children}
      </Grid>
    </Grid>
  )
}