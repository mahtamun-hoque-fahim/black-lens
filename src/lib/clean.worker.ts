import { processRequest, type WorkerRequest } from "./clean-process"

// The worker's global scope. Typed by hand because the project's TypeScript setup uses the DOM library.
const scope = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
}

scope.onmessage = async (event) => {
  const response = await processRequest(event.data)
  // Hand the cleaned bytes over instead of copying them: a 50 MB photo then costs nothing to send back.
  const transfer = response.ok && response.result ? [response.result.bytes.buffer as ArrayBuffer] : []
  scope.postMessage(response, transfer)
}
