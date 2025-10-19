import BlurCode from "@/components/BlurCode";
import { canViewCodes } from "@/lib/access";

// ...
{r.code ? (
  <div className="mt-2">
    <div className="text-xs opacity-80">Bathroom code</div>
    <div className="font-mono text-xl">
      <BlurCode show={canViewCodes(me)}>{r.code}</BlurCode>
    </div>
    {r.code_updated_at && (
      <div className="text-xs opacity-70">
        Updated {new Date(r.code_updated_at).toLocaleString()}
      </div>
    )}
  </div>
) : (
  <div className="mt-2 text-xs opacity-70">No code yet</div>
)}
