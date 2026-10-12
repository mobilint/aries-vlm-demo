import Image from "next/image";
import { Fragment } from "react";

export default function ModelIcon({
  model_id,
  width,
}: {
  model_id: string,
  width?: string,
}) {
  const model_group = model_id.split("/")[0];
  const model_group_icon = model_group == "LGAI-EXAONE" ? "exaone_icon.png" :
                            model_group == "naver-hyperclovax" ? "hyperclovax_icon.png" :
                            model_group == "meta-llama" ? "meta_icon.png" :
                            model_group == "CohereLabs" ? "cohere_icon.png" :
                            model_group == "Qwen" ? "qwen_icon.webp" : undefined;
  return (
    <Fragment>
    {model_group_icon &&
      <Image
        src={"/models/" + model_group_icon}
        alt={model_group}
        width={22}
        height={22}
        style={{
          minWidth: width || "22px",
          maxWidth: width || "22px",
          height: "auto",
        }}
      />
    }
    </Fragment>
  );
}