export async function runSetup(): Promise<void> {
  if (process.env.WIZZZARD_SETUP_STUB === "1") {
    console.error("setup stub");
    process.exit(2);
  }
  console.error("wizzzard setup is not implemented yet");
  process.exit(1);
}
