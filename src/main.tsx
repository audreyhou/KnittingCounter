import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { importFiles, isSupportedFile } from './lib/importer'
import { navigate } from './router'
import './pwa'
import './styles.css'

// Files opened with the installed app (PWA file handling).
interface LaunchParams {
  files: { getFile(): Promise<File> }[]
}
const launchQueue = (window as unknown as { launchQueue?: { setConsumer(cb: (p: LaunchParams) => void): void } }).launchQueue
launchQueue?.setConsumer(async (params) => {
  if (!params.files?.length) return
  const files = (await Promise.all(params.files.map((h) => h.getFile()))).filter(isSupportedFile)
  if (!files.length) return
  const items = await importFiles(files)
  if (items.length === 1) navigate(`/pattern/${items[0].id}`)
  else navigate('/library')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
