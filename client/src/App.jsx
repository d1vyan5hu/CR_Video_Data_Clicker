import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const iframeRef = useRef(null);

  const [videoUrl, setVideoUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  const [features, setFeatures] = useState([]);
  const [featureName, setFeatureName] = useState("");

  const [annotations, setAnnotations] = useState([]);

  const [pendingAnnotation, setPendingAnnotation] =
    useState(null);

  const [formData, setFormData] = useState({});

  const [isAnnotationMode, setIsAnnotationMode] =
    useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const formDataObj = new FormData();

    formDataObj.append("video", file);

    const response = await axios.post(
      "http://localhost:5000/upload",
      formDataObj
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

  const addFeature = () => {
    if (!featureName.trim()) return;

    if (features.includes(featureName.trim()))
      return;

    setFeatures((prev) => [
      ...prev,
      featureName.trim(),
    ]);

    setFeatureName("");
  };

  const removeFeature = (featureToRemove) => {
    setFeatures((prev) =>
      prev.filter(
        (feature) =>
          feature !== featureToRemove
      )
    );
  };

  const saveAnnotation = () => {
    const newAnnotation = {
      ...pendingAnnotation,
      fields: formData,
    };

    setAnnotations((prev) => [
      ...prev,
      newAnnotation,
    ]);

    setPendingAnnotation(null);
    setFormData({});
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
        if (!isAnnotationMode) return;

        setPendingAnnotation({
          x: event.data.x,
          y: event.data.y,
          time: event.data.time,
        });

        setFormData({});
      }
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
  }, [isAnnotationMode]);

  return (
    <div className="app">
      <div className="header">
        <h1>🎥 Video Data Clicker</h1>

        <p>
          Create custom annotation
          workflows for any video
        </p>
      </div>

      <div className="upload-card">
        <h2>Upload Video</h2>

        <input
          type="file"
          accept="video/*"
          onChange={handleUpload}
        />
      </div>

      {videoUrl && (
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

            <div className="controls">
              <h3>
                Current Time:{" "}
                {currentTime.toFixed(2)}
                s
              </h3>

              <button
                onClick={playVideo}
              >
                ▶ Play
              </button>

              <button
                onClick={pauseVideo}
              >
                ⏸ Pause
              </button>

              <button
                onClick={() =>
                  setSpeed(0.5)
                }
              >
                0.5x
              </button>

              <button
                onClick={() =>
                  setSpeed(1)
                }
              >
                1x
              </button>

              <button
                onClick={() =>
                  setSpeed(2)
                }
              >
                2x
              </button>

              <button
                onClick={() =>
                  setSpeed(4)
                }
              >
                4x
              </button>
            </div>
          </div>

          <div className="right-panel">
            <h2>
              Annotation Setup
            </h2>

            <div className="feature-input-row">
              <input
                value={featureName}
                placeholder="Type, Direction, Lane..."
                onChange={(e) =>
                  setFeatureName(
                    e.target.value
                  )
                }
              />

              <button
                onClick={addFeature}
              >
                Add
              </button>
            </div>

            <div className="feature-list">
              {features.map(
                (feature) => (
                  <div
                    key={feature}
                    className="feature-chip"
                  >
                    <span>
                      {feature}
                    </span>

                    <button
                      onClick={() =>
                        removeFeature(
                          feature
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                )
              )}
            </div>

            <button
              className="start-btn"
              onClick={() =>
                setIsAnnotationMode(
                  !isAnnotationMode
                )
              }
            >
              {isAnnotationMode
                ? "Stop Annotation"
                : "Start Annotation"}
            </button>

            {pendingAnnotation && (
              <div className="annotation-form">
                <h3>
                  New Annotation
                </h3>

                <p>
                  Time:{" "}
                  {pendingAnnotation.time.toFixed(
                    2
                  )}
                </p>

                {features.map(
                  (feature) => (
                    <div
                      key={feature}
                      className="form-field"
                    >
                      <label>
                        {feature}
                      </label>

                      <input
                        value={
                          formData[
                            feature
                          ] || ""
                        }
                        onChange={(
                          e
                        ) =>
                          setFormData(
                            (
                              prev
                            ) => ({
                              ...prev,
                              [feature]:
                                e
                                  .target
                                  .value,
                            })
                          )
                        }
                        placeholder={`Enter ${feature}`}
                      />
                    </div>
                  )
                )}

                <button
                  onClick={
                    saveAnnotation
                  }
                >
                  Save Annotation
                </button>
              </div>
            )}

            <h2>
              Annotations
            </h2>

            <div className="annotation-count">
              Total:{" "}
              {annotations.length}
            </div>

            {annotations.map(
              (
                annotation,
                index
              ) => (
                <div
                  key={index}
                  className="annotation-item"
                >
                  <strong>
                    #
                    {index + 1}
                  </strong>

                  <br />

                  Time:{" "}
                  {annotation.time.toFixed(
                    2
                  )}

                  <br />

                  X:{" "}
                  {annotation.x.toFixed(
                    0
                  )}

                  <br />

                  Y:{" "}
                  {annotation.y.toFixed(
                    0
                  )}

                  <hr />

                  {Object.entries(
                    annotation.fields
                  ).map(
                    ([
                      key,
                      value,
                    ]) => (
                      <div
                        key={key}
                      >
                        <strong>
                          {key}
                        </strong>
                        : {value}
                      </div>
                    )
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;