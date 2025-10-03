import type { AppProps } from "next/app";
import "leaflet/dist/leaflet.css";
import "@/styles/globals.css"; // if you have it

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}