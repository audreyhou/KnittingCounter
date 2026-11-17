import { Icon, type IconName } from './components/Icon'
import { ToastProvider } from './components/Toast'
import { LibraryPage } from './pages/LibraryPage'
import { PatternPage } from './pages/PatternPage'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ToolsPage } from './pages/ToolsPage'
import { useRoute, type Route } from './router'

const NAV: { name: Route['name']; href: string; icon: IconName; label: string }[] = [
  { name: 'projects', href: '#/', icon: 'projects', label: 'My Projects' },
  { name: 'library', href: '#/library', icon: 'library', label: 'Library' },
  { name: 'tools', href: '#/tools', icon: 'tools', label: 'Tools' },
]

export default function App() {
  const route = useRoute()
  const section = route.name === 'project' ? 'projects' : route.name === 'pattern' ? 'library' : route.name

  let page
  switch (route.name) {
    case 'project':
      page = <ProjectPage key={route.id} id={route.id!} />
      break
    case 'library':
      page = <LibraryPage />
      break
    case 'pattern':
      page = <PatternPage key={route.id} id={route.id!} />
      break
    case 'tools':
      page = <ToolsPage />
      break
    default:
      page = <ProjectsPage />
  }

  return (
    <ToastProvider>
      <div className={`app route-${route.name}`}>
        <nav className="nav" aria-label="Main">
          <a className="brand" href="#/">
            <img src="./logo.svg" alt="" width={34} height={34} />
            <span>KnitCount</span>
          </a>
          {NAV.map((n) => (
            <a key={n.name} href={n.href} className={`nav-item ${section === n.name ? 'on' : ''}`} aria-current={section === n.name ? 'page' : undefined}>
              <Icon name={n.icon} size={24} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <main className="main">{page}</main>
      </div>
    </ToastProvider>
  )
}
