import type { AppProps } from "next/app";
import { Toaster } from "react-hot-toast";
import "leaflet/dist/leaflet.css";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-center" />
    </>
  );
}
