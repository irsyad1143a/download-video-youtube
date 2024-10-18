const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const app = express();
const port = 3000;

// Path ke yt-dlp.exe
const ytDlpPath = path.join(__dirname, "yt-dlp.exe");

// Path ke folder Downloads
const downloadDir = "C:\\Users\\VivoBook14\\Downloads";

// Pastikan folder Downloads ada
if (!fs.existsSync(downloadDir)) {
  console.error("Folder Downloads tidak ditemukan! Pastikan path sudah benar.");
  process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/download", async (req, res) => {
  const videoURL = req.query.url;
  const format = req.query.format || "mp4";
  const resolution = req.query.resolution || "best";
  const fileName = req.query.fileName || "video";

  if (!videoURL) {
    return res.status(400).send("URL video tidak disediakan.");
  }

  try {
    // Buat nama file yang unik dengan timestamp
    const timestamp = Date.now();
    const outputPath = path.join(downloadDir, `${fileName}-${timestamp}.${format}`);

    // Command arguments untuk yt-dlp
    let args = [videoURL, "-o", outputPath, "--no-check-certificates"];

    if (format === "mp3") {
      // Konversi MP3 agar tidak corrupt
      args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
    } else {
      if (resolution === "best") {
        args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");
      } else {
        args.push(`-f bestvideo[height<=${resolution}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${resolution}][ext=mp4]/best[ext=mp4]`);
      }
    }

    console.log("Starting download with command:", ytDlpPath, args.join(" "));

    // Jalankan yt-dlp
    const download = new Promise((resolve, reject) => {
      const ytDlp = spawn(ytDlpPath, args);

      let errorOutput = "";

      ytDlp.stdout.on("data", (data) => {
        console.log(`stdout: ${data}`);
      });

      ytDlp.stderr.on("data", (data) => {
        errorOutput += data.toString();
        console.error(`stderr: ${data}`);
      });

      ytDlp.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp process exited with code ${code}. Error: ${errorOutput}`));
        }
      });

      ytDlp.on("error", (err) => {
        reject(new Error(`Failed to start yt-dlp process: ${err.message}`));
      });
    });

    // Tunggu proses download selesai
    await download;

    // Pastikan file telah dibuat
    if (!fs.existsSync(outputPath)) {
      throw new Error("File output tidak ditemukan setelah download");
    }

    // Gunakan res.download untuk mengirim file sebagai lampiran
    res.download(outputPath, `${fileName}.${format}`, (err) => {
      if (err) {
        console.error("Error saat mengirim file:", err);
        res.status(500).send("Terjadi kesalahan saat mengirim file.");
      } else {
        console.log("File berhasil dikirim dan diunduh.");
      }
    });
  } catch (err) {
    console.error("Error:", err);
    if (!res.headersSent) {
      res.status(500).send("Terjadi kesalahan saat mengunduh video: " + err.message);
    }
  }
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
