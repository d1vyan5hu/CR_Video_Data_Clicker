import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const iframeRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

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
      <h1>Video Data Clicker</h1>

      <div className="upload-card">
        <input
          type="file"
          accept="video/*"
          onChange={handleUpload}
        />
      </div>

      {videoUrl && (
        <>
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
            
          <div
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