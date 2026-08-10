import { ShaderBackground } from "@/components/ui/blue-noise"

export default function ShaderBackgroundDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <ShaderBackground className="h-full w-full" />
    </div>
  )
}
