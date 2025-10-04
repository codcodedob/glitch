import { useEffect, useRef, useState } from "react";

type Candidate = {
  place_id?: string;
  establishment_id?: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  code?: string | null;
  code_updated_at?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  place: Candidate | null;
  onSaved?: (newCode: string) => void;
};

export default function UpdateCodeModal({ open, onClose, place, onSaved }: Props) {
  // … component body …
  return open && place ? (/* JSX */) : null;
}
