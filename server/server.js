const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());

app.use(
  "/videos",
  express.static(path.join(__dirname, "../uploads"))
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "../uploads");
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

app.post("/upload", upload.single("video"), (req, res) => {
  const videoUrl =
    "http://localhost:5000/player/" +
    req.file.filename;

  res.json({
    success: true,
    videoUrl,
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});

app.get("/player/:filename", (req, res) => {
  const filename = req.params.filename;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Video Player</title>

      <style>
        body{
          margin:0;
          background:black;
          display:flex;
          justify-content:center;
          align-items:center;
          height:100vh;
        }

        video{
          width:100%;
          height:100%;
        }


        #container{
          position:relative;
          width:100%;
          height:100vh;
        }

        .marker{
          
         position:absolute;
          
         width:14px;
         height:14px;
          
         background:red;
          
         border-radius:50%;
          
         transform:
           translate(-50%,-50%);
          
         pointer-events:none;
        }

      </style>

    </head>

    <body>
    <div id="container">
      <video
        id="video"
        controls
      >
        <source
          src="/videos/${filename}"
          type="video/mp4"
        />
      </video>
      <div class="marker"></div>

      </div>
    
      <script>
    
        const video =
          document.getElementById("video");
          
        const container =
         document.getElementById(
           "container"
         );
    
        window.addEventListener(
          "message",
          (event) => {
        
            const data = event.data;
    
            if(data.type === "PLAY"){
              video.play();
            }
    
            if(data.type === "PAUSE"){
              video.pause();
            }
    
            if(data.type === "SET_SPEED"){
              video.playbackRate =
                data.speed;
            }
    
          }
        );

        video.addEventListener(
          "click",
          (event) => {
          
            const rect =
              video.getBoundingClientRect();

            const x =
              event.clientX - rect.left;

            const y =
              event.clientY - rect.top;

            const newMarker =
             document.createElement("div");

            newMarker.className =
             "marker";

            newMarker.style.left =
             x + "px";

            newMarker.style.top =
             y + "px";

            container.appendChild(
             newMarker
            );

            window.parent.postMessage(
              {
                type: "VIDEO_CLICK",

                x,
                y,

                time:
                  video.currentTime,
              },
              "*"
            );

          }
        );

        setInterval(() => {

          window.parent.postMessage(
            {
              type: "CURRENT_TIME",
              currentTime: video.currentTime
            },
            "*"
          );
        
        }, 500);
    
      </script>
    
    </body>
    </html>
  `);
});