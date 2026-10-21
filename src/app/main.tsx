import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Output } from './Output'
import '@fontsource-variable/inter'
import './styles.css'

const view = new URLSearchParams(location.search).get('view')
createRoot(document.getElementById('root')!).render(view === 'output' ? <Output /> : <App />)
