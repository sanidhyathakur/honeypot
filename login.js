$(document).ready(function () {
  let failedAttempts = 0;
  const MAX_ATTEMPTS = 3;
  const SECURITY_DELAY = 2000; // 2 seconds delay for security actions
  let captureInProgress = false;

  // Clean up old data on page load
  cleanupOldData();

  // Toggle password visibility
  $("#togglePassword").click(function () {
    const password = $("#password");
    const type = password.attr("type") === "password" ? "text" : "password";
    password.attr("type", type);
    $(this).toggleClass("fa-eye fa-eye-slash");
  });

  // Form submission
  $("#loginForm").submit(function (e) {
    e.preventDefault();

    const username = $("#username").val().trim();
    const password = $("#password").val().trim();

    if (!username || !password) {
      showAlert("Please enter both username and password", "danger");
      return;
    }

    // Show loading state
    $("#btnText").hide();
    $("#spinner").show();
    $("#loginBtn").addClass("btn-disabled").prop("disabled", true);

    // Simulate API call with delay
    setTimeout(() => {
      authenticateUser(username, password);
    }, 1500);
  });

  function authenticateUser(username, password) {
    // Replace with actual authentication logic
    const validUsername = "admin";
    const validPassword = "uV#Ejdv0qH";

    if (username === validUsername && password === validPassword) {
      // Successful login
      showAlert("Login successful! Redirecting...", "success");
      window.location.href = "dashboard.html";
    } else {
      failedAttempts++;

      // Store the failed attempts count in localStorage
      const attemptData = {
        ip: "unknown",
        timestamp: new Date().toISOString(),
        count: failedAttempts,
      };

      // Save to localStorage
      const existingAttempts = JSON.parse(
        localStorage.getItem("loginAttempts") || "{}"
      );
      existingAttempts[username] = existingAttempts[username] || { count: 0 };
      existingAttempts[username].count++;
      existingAttempts[username].lastAttempt = new Date().toISOString();
      localStorage.setItem("loginAttempts", JSON.stringify(existingAttempts));

      // Notify the dashboard of the new attempt
      updateDashboardAttempts(username, existingAttempts[username].count);

      if (failedAttempts >= MAX_ATTEMPTS && !captureInProgress) {
        // Trigger security protocol
        captureInProgress = true;
        showAlert(
          "Maximum login attempts reached! Security protocol activated.",
          "danger"
        );
        captureIntruderDetails();
      } else if (failedAttempts < MAX_ATTEMPTS) {
        const remaining = MAX_ATTEMPTS - failedAttempts;
        showAlert(
          `Invalid credentials. ${remaining} attempt${
            remaining !== 1 ? "s" : ""
          } remaining.`,
          "warning"
        );
        resetLoginButton();
      }
    }
  }

  // Add this new function to notify the dashboard
  function updateDashboardAttempts(username, count) {
    // Method 1: Using localStorage
    localStorage.setItem(
      "lastFailedAttempt",
      JSON.stringify({
        username: username,
        count: count,
        timestamp: new Date().toISOString(),
      })
    );

    // Method 2: Using postMessage for real-time updates
    window.postMessage(
      {
        type: "failedAttempt",
        data: {
          username: username,
          count: count,
        },
      },
      "*"
    );
  }

  // Capture IP details and webcam image of the intruder
  async function captureIntruderDetails() {
    try {
      // First get IP info
      const ipData = await captureIPDetails();

      // Then attempt to capture webcam image
      try {
        const imageData = await captureWebcamImage();
        await saveIntruderData(ipData, imageData);
      } catch (cameraError) {
        console.error("Camera access error:", cameraError);
        // Even if camera fails, still save IP data
        await saveIntruderData(ipData, null);
      }

      // Continue with security protocol
      triggerSecurityProtocol();
    } catch (error) {
      console.error("Error capturing intruder details:", error);
      showAlert("Security system error. Administrator notified.", "danger");
      triggerSecurityProtocol();
    }
  }

  async function captureIPDetails() {
    try {
      const response = await fetch("https://ipinfo.io/json");
      if (!response.ok) {
        throw new Error("Failed to fetch IP information");
      }
      return await response.json();
    } catch (error) {
      console.error("IP info error:", error);
      return { ip: "unknown", loc: "unknown" };
    }
  }

  async function captureWebcamImage() {
    try {
      // Create video and canvas elements
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");

      // Position video off-screen
      video.style.position = "fixed";
      video.style.top = "-1000px";
      document.body.appendChild(video);

      // Request webcam access with improved constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // Set up video element
      video.srcObject = stream;
      video.setAttribute("playsinline", true); // Required for iOS
      video.play();

      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.width = video.videoWidth;
          video.height = video.videoHeight;
          resolve();
        };
      });

      // Wait a moment to ensure the camera is active and adjusted
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Set canvas dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Capture frame
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Stop video stream and clean up
      stream.getTracks().forEach((track) => track.stop());
      document.body.removeChild(video);

      // Convert to base64 with quality setting (80%)
      return canvas.toDataURL("image/jpeg", 0.8);
    } catch (error) {
      console.error("Webcam capture error:", error);
      throw new Error("Failed to capture webcam image: " + error.message);
    }
  }

  async function saveIntruderData(ipData, imageData) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "")
      .slice(0, 15);
    const filename = `Intruder_${timestamp}.jpg`;

    // Create an object with all the intruder data
    const intruderData = {
      timestamp: timestamp,
      ip: ipData.ip,
      location: ipData.loc,
      city: ipData.city || "",
      region: ipData.region || "",
      country: ipData.country || "",
      org: ipData.org || "",
      postal: ipData.postal || "",
      filename: filename,
      imageData: imageData, // base64 image data
    };

    console.log("Captured intruder data:", {
      ip: ipData.ip,
      location: ipData.loc,
      image: filename,
    });

    // Store in localStorage for persistence
    try {
      // Store the main data
      const intruders = JSON.parse(localStorage.getItem("intruders") || "[]");
      intruders.push(intruderData);
      localStorage.setItem("intruders", JSON.stringify(intruders));

      // Update dashboard if open
      updateDashboard(intruderData);

      return true;
    } catch (error) {
      console.error("Error saving intruder data:", error);
      return false;
    }
  }

  // Function to update dashboard if it's open
  function updateDashboard(intruderData) {
    // Method 1: Using localStorage for reliable data transfer
    localStorage.setItem("lastIntruder", JSON.stringify(intruderData));

    // Method 2: Using postMessage for already open windows
    window.postMessage(
      {
        type: "newIntruder",
        data: intruderData,
      },
      "*"
    );

    // Method 3: Open the dashboard if it's not already open
    const dashboardWindow = window.open("ip-dashboard.html", "_blank");
  }

  function triggerSecurityProtocol() {
    // Disable form
    $("#username, #password").prop("disabled", true);
    $("#loginBtn").hide();
    $("#formLock").fadeIn();

    // Store attempt info in localStorage for persistence
    const attemptInfo = {
      timestamp: new Date().toISOString(),
      attempts: failedAttempts,
      username: $("#username").val(),
    };
    localStorage.setItem("lastFailedAttempt", JSON.stringify(attemptInfo));

    // Display security alert
    showAlert(
      "Security team has been notified with intruder details.",
      "danger"
    );
  }

  function resetLoginButton() {
    $("#btnText").show();
    $("#spinner").hide();
    $("#loginBtn").removeClass("btn-disabled").prop("disabled", false);
  }

  // Add cleanup function for expired data
  function cleanupOldData() {
    try {
      const intruders = JSON.parse(localStorage.getItem("intruders") || "[]");
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds

      // Remove entries older than 2 days
      const filteredIntruders = intruders.filter((intruder) => {
        const timestamp = new Date(intruder.timestamp).getTime();
        return Date.now() - timestamp < TWO_DAYS;
      });

      localStorage.setItem("intruders", JSON.stringify(filteredIntruders));
    } catch (error) {
      console.error("Error cleaning up old data:", error);
    }
  }

  function showAlert(message, type) {
    const alertBox = $("#alertBox");
    alertBox
      .removeClass("alert-danger alert-warning alert-success")
      .addClass(`alert-${type}`)
      .text(message)
      .hide()
      .fadeIn();

    if (type !== "success") {
      setTimeout(() => {
        alertBox.fadeOut();
      }, 5000);
    }
  }
});
