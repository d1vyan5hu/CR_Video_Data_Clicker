// App.jsx
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const iframeRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [label, setLabel] = useState("");
 const [annotationTypes, setAnnotationTypes] =
     useState([
       "Person",
       "Car",
       "Truck"
     ]);
  const [newType, setNewType] = useState("");
  const [features, setFeatures] = useState([]);
  const [featureName, setFeatureName] = useState("");
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("video", file);

    const response = await axios.post(
      "http://localhost:5000/upload",
      formData
    );

    setVideoUrl(response.data.videoUrl);
  };

  const playVideo = () => {
    iframeRef.current?.contentWindow.postMessage(
      {
        type: "PLAY",
      },
      "*"
    );
  };

  const pauseVideo = () => {
    iframeRef.current?.contentWindow.postMessage(
      {
        type: "PAUSE",
      },
      "*"
    );
  };

  const setSpeed = (speed) => {
    iframeRef.current?.contentWindow.postMessage(
      {
        type: "SET_SPEED",
        speed,
      },
      "*"
    );
  };

  useEffect(() => {

    const handler = (event) => {

      if (
        event.data.type ===
        "CURRENT_TIME"
      ) {
        setCurrentTime(
          event.data.currentTime
        );
      }

      if (
        event.data.type ===
        "VIDEO_CLICK"
      ) {

        if (!isAnnotationMode)
          return;

        setPendingAnnotation({
          x: event.data.x,
          y: event.data.y,
          time: event.data.time,
        });
      }

      console.log(
        "CLICK",
        event.data
      );

    };

    window.addEventListener(
      "message",
      handler
    );

    return () => {
      window.removeEventListener(
        "message",
        handler
      );
    };

  }, []);

  return (
    <div className="app">
      <h1>🎥 Video Data Clicker</h1>

      <p>
        Upload videos, annotate events,
        and collect structured data.
      </p>

      <div className="upload-card">
        <input
          type="file"
          accept="video/*"
          onChange={handleUpload}
        />
      </div>

      <div className="feature-builder">

        <h2>
          Annotation Features
        </h2>

        <div className="feature-input-row">

          <input
            value={featureName}
            onChange={(e) =>
              setFeatureName(
                e.target.value
              )
            }
            placeholder="Type, Direction, Lane..."
          />

          <button
            onClick={() => {
            
              if (!featureName.trim())
                return;
            
              setFeatures(prev => [
                ...prev,
                featureName
              ]);
            
              setFeatureName("");
            
            }}
          >
            Add
          </button>
          
        </div>
          
        <div className="feature-list">
          
          {features.map(
            (feature, index) => (
            
              <div
                key={index}
                className="feature-chip"
              >
                {feature}
              </div>

            )
          )}

        </div>
        
      </div>

      {videoUrl && (
        <>
        <div className="workspace">
          <div className="left-panel">

            <div className="video-container">
              <iframe
                ref={iframeRef}
                title="video-player"
                src={videoUrl}
                width="100%"
                height="600"
                style={{
                  border: "none",
                  borderRadius: "12px",
                }}
              />
            </div>
          </div>

          <div className="feature-builder">

            <h2>
              Annotation Features
            </h2>

            <div className="feature-input-row">

              <input
                value={featureName}
                onChange={(e) =>
                  setFeatureName(e.target.value)
                }
                placeholder="Type, Direction, Lane..."
              />

              <button
                onClick={() => {
                
                  if (!featureName.trim())
                    return;
                
                  setFeatures(prev => [
                    ...prev,
                    featureName
                  ]);
                
                  setFeatureName("");
                
                }}
              >
                Add
              </button>
              
            </div>
              
          </div>

          <div className="feature-list">

            {features.map(
              (feature, index) => (
              
                <div
                  key={index}
                  className="feature-chip"
                >
                  {feature}
                </div>

              )
            )}

          </div>
          <button
            className="start-btn"
            onClick={() =>
              setIsAnnotationMode(true)
            }
          >
            Start Annotation
          </button>

          <div className="right-panel">
            <div className="type-manager">

              <input
                value={newType}
                onChange={(e)=>
                  setNewType(e.target.value)
                }
                placeholder="New Type"
              />

              <button
                onClick={() => {
                
                  if(!newType.trim())
                    return;
                
                  setAnnotationTypes(prev => [
                    ...prev,
                    newType
                  ]);
                
                  setNewType("");
                
                }}
              >
                Add Type
              </button>
              
            </div>
              
            <div className="type-list">

              {annotationTypes.map(type => (
              
                <div
                  key={type}
                  className="type-chip"
                >
                  {type}
                </div>

              ))}

            </div>

            {pendingAnnotation && (

              <div
                className="annotation-form"
              >
              
                <h3>
                  New Annotation
                </h3>
                        
                <select
                  value={label}
                  onChange={(e) =>
                    setLabel(e.target.value)
                  }
                >
                  <option value="">
                    Select Type
                  </option>
                
                  {annotationTypes.map(type => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ))}
                </select>
            
                <button
                  onClick={() => {

                    if (!label.trim()) {
                      alert("Please enter a label");
                      return;
                    }
                  
                    setAnnotations(
                      prev => [
                        ...prev,
                      
                        {
                          ...pendingAnnotation,
                          label
                        }
                      ]
                    );
                  
                    setPendingAnnotation(
                      null
                    );
                  
                    setLabel("");
                  
                  }}
                >
                  Save
                </button>
                
              </div>
            
            )}
              <h2>Annotations</h2>
                <div className="annotation-count">
                  Total Annotations:
                  {annotations.length}
                </div>

              {annotations.map((item, index) => (
                <div
                  key={index}
                  className="annotation-item"
                >
                  <strong>
                    #{index + 1}
                  </strong>
              
                  <br />
              
                  Time:
                  {" "}
                  {item.time.toFixed(2)}
              
                  <br />
              
                  Label:
                  {" "}
                  {item.label}

                  <br />
              
                  X:
                  {" "}
                  {item.x.toFixed(0)}
              
                  <br />
              
                  Y:
                  {" "}
                  {item.y.toFixed(0)}
                </div>
              ))}
          </div>
        </div>
            
          <div className="controls"
            style={{
              marginTop: "20px",
            }}
          >
            <h2>
             Current Time:
             {" "}
             {currentTime.toFixed(2)}
             sec
            </h2>
            <button onClick={playVideo}>
              Play
            </button>
          
            <button
              onClick={pauseVideo}
              style={{
                marginLeft: "10px",
              }}
            >
              Pause
            </button>
            
            <button
              onClick={() => setSpeed(0.25)}
              style={{
                marginLeft: "10px",
              }}
            >
              0.25x
            </button>
            
            <button
              onClick={() => setSpeed(0.5)}
            >
              0.5x
            </button>
            
            <button
              onClick={() => setSpeed(1)}
            >
              1x
            </button>
            
            <button
              onClick={() => setSpeed(2)}
            >
              2x
            </button>
            
            <button
              onClick={() => setSpeed(4)}
            >
              4x
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;