import { useState } from 'react';
import ProjectManagerScreen from './screens/ProjectManagerScreen';
import ProjectSetupScreen from './screens/ProjectSetupScreen';
import ProjectAnnotationScreen from './screens/ProjectAnnotationScreen';

export default function App() {
  const [activeProject, setActiveProject] = useState(null);
  const [workspaceStage, setWorkspaceStage] = useState('setup'); // 'setup' | 'annotate'
  const [setupContext, setSetupContext] = useState(null);

  const backToProjects = () => {
    setActiveProject(null);
    setWorkspaceStage('setup');
    setSetupContext(null);
  };

  const openProject = (project) => {
    setActiveProject(project);
    setWorkspaceStage('setup');
  };

  const startAnnotating = (context) => {
    setSetupContext(context);
    setWorkspaceStage('annotate');
  };

  if (!activeProject) {
    return <ProjectManagerScreen onOpenProject={openProject} />;
  }

  return (
    <div className="project-workspace">
      <div className="project-workspace-bar">
        <button className="pw-back" onClick={backToProjects}>
          ← Back to Projects
        </button>
        <span className="pw-project-name">{activeProject.name}</span>
        {workspaceStage === 'annotate' && (
          <button className="pw-back" onClick={() => setWorkspaceStage('setup')}>
            Edit Setup
          </button>
        )}
      </div>
      {workspaceStage === 'setup' ? (
        <ProjectSetupScreen
          project={activeProject}
          onProjectUpdated={setActiveProject}
          onStartAnnotating={startAnnotating}
        />
      ) : (
        <ProjectAnnotationScreen
          project={activeProject}
          setupContext={setupContext}
          onBack={() => setWorkspaceStage('setup')}
          onEditSetup={() => setWorkspaceStage('setup')}
        />
      )}
    </div>
  );
}
