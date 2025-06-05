import { useEffect, useState } from "react";
import { Image, ImageBackground, StyleSheet, Switch, Text, View } from "react-native";
import background from "../assets/pexels-reynaldoyodia-13456519.jpg";
import { db, onValue, ref, update } from "../firebase";

const OPENWEATHER_API_KEY = "1e127aa9e4da0c258ef11852e0f5c267";

const Weather = () => {
  const [temp, setTemp] = useState(60);
  const [humidity, setHumidity] = useState(30);
  const [predAC, setPredAC] = useState(null);
  const [predHumid, setPredHumid] = useState(null);

  const [manualAC, setManualAC] = useState(null);
  const [manualHumid, setManualHumid] = useState(null);

  const [mode, setMode] = useState("auto");
  const [switchValue, setSwitchValue] = useState(false); // false = auto, true = manual

  const [weatherDesc, setWeatherDesc] = useState("Loading...");
  const [weatherIcon, setWeatherIcon] = useState(null);
  const [surabayaTemp, setSurabayaTemp] = useState(null);

  useEffect(() => {
    // Data sensor temp dan humidity
    const dataRef = ref(db);
    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        if (val.temp !== undefined) setTemp(Math.round(val.temp));
        if (val.humid !== undefined) setHumidity(Math.round(val.humid));
        if (val.mode) {
          setMode(val.mode);
          setSwitchValue(val.mode === "manual");
        }
        if (val.manual_status) {
          setManualAC(val.manual_status.ac);
          setManualHumid(val.manual_status.humidifier);
        }
      }
    });

    // Fetch weather from OpenWeatherMap
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Surabaya,id&appid=${OPENWEATHER_API_KEY}&units=metric&lang=id`
    )
      .then((res) => res.json())
      .then((data) => {
        const desc = data.weather[0].description;
        const tempSby = data.main.temp;
        const icon = data.weather[0].icon;

        setWeatherDesc(desc.charAt(0).toUpperCase() + desc.slice(1));
        setWeatherIcon(`https://openweathermap.org/img/wn/${icon}@2x.png`);
        setSurabayaTemp(Math.round(tempSby));
      })
      .catch((err) => {
        console.error("OpenWeather Error:", err);
        setWeatherDesc("Error fetching weather");
      });

    // Ambil hasil prediksi AI (AC dan Humidifier) dari Firebase Realtime DB (/output)
    const outputRef = ref(db, "/output");
    onValue(outputRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setPredAC(val.prediksi_ac);
        setPredHumid(val.prediksi_humid);
      }
    });
  }, []);

  // Toggle mode manual/auto
  const toggleSwitchMode = () => {
    const newMode = switchValue ? "auto" : "manual"; // switchValue true berarti manual, jadi toggle ke auto
    update(ref(db), { mode: newMode });
    setMode(newMode);
    setSwitchValue(!switchValue);
  };

  // Toggle AC sesuai mode
  const toggleAC = () => {
    if (mode === "manual") {
      const newVal = manualAC === "ON" ? "OFF" : "ON";
      update(ref(db, "/manual_status"), { ac: newVal });
      setManualAC(newVal);
    } else {
      const newVal = predAC === "ON" ? "OFF" : "ON";
      update(ref(db, "/output"), { prediksi_ac: newVal });
      setPredAC(newVal);
    }
  };

  // Toggle Humidifier sesuai mode
  const toggleHumid = () => {
    if (mode === "manual") {
      const newVal = manualHumid === "ON" ? "OFF" : "ON";
      update(ref(db, "/manual_status"), { humidifier: newVal });
      setManualHumid(newVal);
    } else {
      const newVal = predHumid === "ON" ? "OFF" : "ON";
      update(ref(db, "/output"), { prediksi_humid: newVal });
      setPredHumid(newVal);
    }
  };

  let suggestionText = "";
  const acStatus = mode === "manual" ? manualAC : predAC;
  const humidStatus = mode === "manual" ? manualHumid : predHumid;

  if (mode === "manual") {
    suggestionText = ""; // Tidak menampilkan saran saat manual
  } else {
    if (acStatus === "ON" && humidStatus === "ON") {
      suggestionText = "Nyalakan AC dan air humidifier";
    } else if (acStatus === "ON") {
      suggestionText = "Nyalakan AC";
    } else if (humidStatus === "ON") {
      suggestionText = "Nyalakan air humidifier";
    } else if (acStatus === "OFF" && humidStatus === "OFF") {
      suggestionText = "Ruangan dalam kondisi baik";
    } else {
      suggestionText = "Menunggu data prediksi...";
    }
  }

  return (
    <ImageBackground source={background} style={styles.container}>
      <View style={styles.overlay} />
      <View style={styles.content}>
        {/* Switch Mode Manual/Auto */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, top: 80 }}>
          <Text style={{ color: "white", fontSize: 16, marginRight: 10 }}>
            Mode: {mode === "manual" ? "Manual" : "Auto"}
          </Text>
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={switchValue ? "#f5dd4b" : "#f4f3f4"}
            onValueChange={toggleSwitchMode}
            value={switchValue}
          />
        </View>

        <View style={styles.weatherDescWrapper}>
          {weatherIcon && <Image source={{ uri: weatherIcon }} style={styles.icon} />}
          <Text style={styles.weatherDesc}>{weatherDesc}</Text>
          {surabayaTemp !== null && <Text style={styles.cityTemp}>Surabaya: {surabayaTemp}°C</Text>}
        </View>

        {/* Sensor Data */}
        <View style={styles.data}>
          <View style={styles.spacer} />

          {/* Saran Dinamis */}
          {suggestionText !== "" && (
            <View style={styles.suggestionWrapper}>
              <Text style={styles.suggestionTitle}>Saran</Text>
              <Text style={styles.suggestionContent}>{suggestionText}</Text>
            </View>
          )}

          {/* Switch Toggle AC dan Humidifier hanya saat mode manual */}
          {mode === "manual" && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>AC</Text>
                <Switch
                  trackColor={{ false: "#767577", true: "#81b0ff" }}
                  thumbColor={acStatus === "ON" ? "#f5dd4b" : "#f4f3f4"}
                  onValueChange={toggleAC}
                  value={acStatus === "ON"}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Humidifier</Text>
                <Switch
                  trackColor={{ false: "#767577", true: "#81b0ff" }}
                  thumbColor={humidStatus === "ON" ? "#f5dd4b" : "#f4f3f4"}
                  onValueChange={toggleHumid}
                  value={humidStatus === "ON"}
                />
              </View>
            </>
          )}

          <View style={styles.dataWrapper}>
            <View style={styles.humid}>
              <Text style={styles.dataText}>{humidity}%</Text>
              <Text style={styles.title}>Kelembapan</Text>
            </View>
            <View style={styles.temp}>
              <Text style={styles.dataText}>{temp}°C</Text>
              <Text style={styles.title}>Suhu Sensor</Text>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default Weather;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    resizeMode: "cover",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    zIndex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 1,
    ...StyleSheet.absoluteFillObject,
  },
  weatherDescWrapper: {
    top: 50,
    padding: 25,
    borderRadius: 12,
    alignItems: "center",
    maxWidth: "70%",
  },
  icon: {
    width: 140,
    height: 100,
    marginBottom: 5,
  },
  weatherDesc: {
    fontSize: 18,
    color: "white",
    fontWeight: "bold",
    textTransform: "capitalize",
    textAlign: "center",
  },
  cityTemp: {
    fontSize: 16,
    color: "#fff",
    marginTop: 4,
    fontWeight: "600",
  },
  data: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  spacer: {
    height: "30%",
  },
  suggestionWrapper: {
    backgroundColor: "rgba(216, 214, 214, 0.35)",
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "white",
    width: "80%",
    alignItems: "center",
  },
  suggestionTitle: {
    fontSize: 14,
    color: "white",
    marginBottom: 5,
    textAlign: "center",
  },
  suggestionContent: {
    fontSize: 14,
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "80%",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  switchLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  dataWrapper: {
    backgroundColor: "rgba(216, 214, 214, 0.35)",
    flexDirection: "row",
    height: "10%",
    justifyContent: "center",
    alignItems: "center",
    width: "80%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "white",
  },
  humid: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  temp: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dataText: {
    fontSize: 30,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 14,
    color: "white",
    textAlign: "center",
    fontFamily: "Helvetica",
  },
});
