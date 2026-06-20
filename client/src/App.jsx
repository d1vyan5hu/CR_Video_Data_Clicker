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

try {
  const response = await axios.post(
    "http://localhost:5000/upload",
    formDataObj
  );

  setVideoUrl(response.data.videoUrl);
} catch (error) {
  console.error(error);
  alert("Video upload failed");
}


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
const normalized =
featureName.trim();


if (!normalized) return;

if (
  features.some(
    feature =>
      feature.toLowerCase() ===
      normalized.toLowerCase()
  )
) {
  alert("Feature already exists");
  return;
}

setFeatures(prev => [
  ...prev,
  normalized,
]);

setFeatureName("");


};

const removeFeature = (
featureToRemove
) => {
setFeatures(prev =>
prev.filter(
feature =>
feature !==
featureToRemove
)
);
};

const saveAnnotation =
async () => {


  if (
    features.length === 0
  ) {
    alert(
      "Add at least one feature"
    );
    return;
  }

  const hasValue =
    Object.values(
      formData
    ).some(
      value =>
        value?.trim()
    );

  if (!hasValue) {
    alert(
      "Fill annotation fields"
    );
    return;
  }

  const newAnnotation = {
    ...pendingAnnotation,
    fields: formData,
  };

  try {

    await axios.post(
      "http://localhost:5000/annotations",
      {
        timestamp:
          pendingAnnotation.time,

        x:
          pendingAnnotation.x,

        y:
          pendingAnnotation.y,

        fields:
          formData,
      }
    );

    setAnnotations(
      prev => [
        ...prev,
        newAnnotation,
      ]
    );

    setPendingAnnotation(
      null
    );

    setFormData({});

  } catch (error) {

    console.error(
      "Save Annotation Error:",
      error
    );

    alert(
      "Failed to save annotation"
    );
  }
};


const downloadJson =
async () => {


  try {

    const response =
      await axios.get(
        "http://localhost:5000/export"
      );

    const blob =
      new Blob(
        [
          JSON.stringify(
            response.data,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        "a"
      );

    a.href = url;

    a.download =
      "annotations.json";

    a.click();

    URL.revokeObjectURL(
      url
    );

  } catch (error) {

    console.error(error);

    alert(
      "Failed to export JSON"
    );

  }
};


useEffect(() => {


const handler = (
  event
) => {

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

    if (
      !isAnnotationMode
    )
      return;

    setPendingAnnotation({
      x: event.data.x,
      y: event.data.y,
      time:
        event.data.time,
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

return ( <div className="app">


  <div className="header">
    <h1>
      🎥 Video Data Clicker
    </h1>

    <p>
      Create custom
      annotation workflows
      for any video
    </p>
  </div>

  <div className="upload-card">

    <h2>
      Upload Video
    </h2>

    <input
      type="file"
      accept="video/*"
      onChange={
        handleUpload
      }
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
              borderRadius:
                "12px",
            }}
          />

        </div>

        <div className="controls">

          <h3>
            Current Time:{" "}
            {currentTime.toFixed(
              2
            )}
            s
          </h3>

          <button
            onClick={
              playVideo
            }
          >
            ▶ Play
          </button>

          <button
            onClick={
              pauseVideo
            }
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

          <button
            onClick={
              downloadJson
            }
          >
            Download JSON
          </button>

        </div>

      </div>

      <div className="right-panel">

        <h2>
          Annotation Setup
        </h2>

        <div className="feature-input-row">

          <input
            value={
              featureName
            }
            placeholder="Type, Direction, Lane..."
            onChange={(
              e
            ) =>
              setFeatureName(
                e.target.value
              )
            }
          />

          <button
            onClick={
              addFeature
            }
          >
            Add
          </button>

        </div>

        <div className="feature-list">

          {features.map(
            feature => (

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
          onClick={() => {

            if (
              isAnnotationMode
            ) {
              setPendingAnnotation(
                null
              );
            }

            setIsAnnotationMode(
              !isAnnotationMode
            );

          }}
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
              feature => (

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
                        prev => ({
                          ...prev,
                          [feature]:
                            e.target
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
