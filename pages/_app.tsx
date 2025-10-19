// pages/_app.tsx (or your main layout)
import type { AppProps } from "next/app";
import "@/styles/globals.css";
import AuthSync from "@/components/AuthSync";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <AuthSync />
      <Component {...pageProps} />
    </>
  );
}
