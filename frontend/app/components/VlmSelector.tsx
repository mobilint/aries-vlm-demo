import { Button, CircularProgress, ListItemText, Menu, MenuItem } from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useState } from "react";
import { getVlmModelLabel } from "../settings";
import ModelIcon from "./ModelIcon";

export default function VlmSelector({
  models,
  currentModel,
  disabled,
  isSwitching,
  changeModel,
}: {
  models: string[],
  currentModel: string,
  disabled: boolean,
  isSwitching: boolean,
  changeModel: (modelId: string) => void,
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isOpen = anchorEl != null;

  return (
    <>
      <Button
        disableElevation
        disabled={disabled || models.length == 0}
        startIcon={
          isSwitching
            ? <CircularProgress size={16} sx={{ color: "#0B4EA2" }} />
            : currentModel ? <ModelIcon model_id={currentModel} width="20px" /> : undefined
        }
        endIcon={<ExpandMoreRoundedIcon sx={{ fontSize: "18px" }} />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          height: "46px",
          padding: "0 18px",
          borderRadius: "999px",
          textTransform: "none",
          fontWeight: 600,
          fontSize: "14px",
          color: "#0B4EA2",
          backgroundColor: "#FFFFFF",
          border: "1px solid #D7DFEF",
          boxShadow: "0 10px 30px rgba(13, 35, 67, 0.08)",
          whiteSpace: "nowrap",
          "&:hover": { backgroundColor: "#F4F8FD" },
          "&.Mui-disabled": { color: "#8EA1B8", backgroundColor: "#F5F7FA", borderColor: "#E2E8F0" },
        }}
      >
        {currentModel ? getVlmModelLabel(currentModel) : "Model"}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              marginTop: "10px",
              borderRadius: "16px",
              border: "1px solid #D7DFEF",
              backgroundColor: "#FFFFFF",
              minWidth: "260px",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(13, 35, 67, 0.15)",
            },
          },
        }}
      >
        {models.map((modelId) => {
          const isActive = currentModel == modelId;
          return (
            <MenuItem
              key={modelId}
              selected={isActive}
              onClick={() => {
                setAnchorEl(null);
                if (modelId != currentModel) changeModel(modelId);
              }}
              sx={{
                minHeight: "44px",
                gap: "10px",
                backgroundColor: isActive ? "#EEF4FC" : "#FFFFFF",
                "&:hover": { backgroundColor: "#F4F8FD" },
              }}
            >
              <ModelIcon model_id={modelId} width="20px" />
              <ListItemText
                primary={getVlmModelLabel(modelId)}
                primaryTypographyProps={{
                  fontSize: "14px",
                  fontWeight: isActive ? 700 : 500,
                  color: "#12233F",
                }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
