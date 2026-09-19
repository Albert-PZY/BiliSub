import type { Metadata } from "next"
import { SpecsPage } from "@/components/specs"

export const metadata: Metadata = {
  title: "工作区规格 · BiliAISub",
  description: "BiliAISub 当前实现中的输入边界、状态顺序和部署边界。",
}

export default function Page() {
  return <SpecsPage />
}
