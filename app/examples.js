/* 自由練習用的範例程式（仿 Arduino IDE「檔案 → 範例」） */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};
const LED13 = { id: 'led1', type: 'led', pin: 13, color: 'red', label: 'LED' };

AJ.EXAMPLES = [
  {
    group: '01.Basics', id: 'blink', title: 'Blink 閃爍',
    desc: '最經典的第一支程式：讓 D13 的 LED 每秒閃一次。試著改 delay 的數字，看看閃爍速度怎麼變。',
    circuit: [LED13],
    code: `// Blink：LED 亮 1 秒、暗 1 秒，一直重複
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);     // LED_BUILTIN 就是 13 號腳
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);  // 打開 LED
  delay(1000);                      // 等 1 秒
  digitalWrite(LED_BUILTIN, LOW);   // 關掉 LED
  delay(1000);                      // 等 1 秒
}
`,
  },
  {
    group: '01.Basics', id: 'analogreadserial', title: 'AnalogReadSerial 讀取類比值',
    desc: '讀取可變電阻（A0）的值，印在序列埠監控視窗。執行後拖動旋鈕，看數字怎麼變。',
    circuit: [{ id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 512 }],
    code: `// AnalogReadSerial：把 A0 的讀值（0~1023）印出來
void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(A0);
  Serial.println(sensorValue);
  delay(100);        // 稍微等一下，數字才不會跑太快
}
`,
  },
  {
    group: '01.Basics', id: 'readvoltage', title: 'ReadAnalogVoltage 換算電壓',
    desc: '把 0~1023 的讀值換算成 0~5V 的電壓，練習 float 小數運算。',
    circuit: [{ id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 512 }],
    code: `// ReadAnalogVoltage：讀值 × (5.0 / 1023.0) = 電壓
void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(A0);
  float voltage = sensorValue * (5.0 / 1023.0);
  Serial.print("電壓：");
  Serial.print(voltage);
  Serial.println(" V");
  delay(200);
}
`,
  },
  {
    group: '01.Basics', id: 'fade', title: 'Fade 漸亮漸暗',
    desc: '用 analogWrite（PWM）讓 D9 的 LED 慢慢變亮再變暗。注意：只有 3、5、6、9、10、11 可以用 PWM。',
    circuit: [{ id: 'led1', type: 'led', pin: 9, color: 'blue', label: 'LED' }],
    code: `// Fade：亮度在 0~255 之間來回變化
int led = 9;
int brightness = 0;    // 目前亮度
int fadeAmount = 5;    // 每次改變多少

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  analogWrite(led, brightness);
  brightness = brightness + fadeAmount;
  // 到了最暗或最亮，就反方向
  if (brightness <= 0 || brightness >= 255) {
    fadeAmount = -fadeAmount;
  }
  delay(30);
}
`,
  },
  {
    group: '02.Digital', id: 'button', title: 'Button 按鈕',
    desc: '這是 Arduino 官方範例的接法：按鈕接 5V，另外用下拉電阻接 GND，所以按下時讀到 HIGH。',
    circuit: [{ id: 'btn', type: 'button', pin: 2, wiring: 'pulldown', label: '按鈕' }, LED13],
    code: `// Button：按住按鈕 LED 就亮
const int buttonPin = 2;
const int ledPin = 13;
int buttonState = 0;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT);
}

void loop() {
  buttonState = digitalRead(buttonPin);
  if (buttonState == HIGH) {     // 下拉電阻接法：按下 = HIGH
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}
`,
  },
  {
    group: '02.Digital', id: 'digitalreadserial', title: 'DigitalReadSerial 讀取按鈕',
    desc: '用 INPUT_PULLUP（內建上拉電阻）讀按鈕，並把 0 / 1 印出來。按住按鈕看看數字怎麼變。',
    circuit: [{ id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '按鈕' }],
    code: `// DigitalReadSerial：放開 = 1，按下 = 0
void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  int buttonState = digitalRead(2);
  Serial.println(buttonState);
  delay(100);
}
`,
  },
  {
    group: '02.Digital', id: 'blinkwithoutdelay', title: 'BlinkWithoutDelay 不用 delay 閃爍',
    desc: '用 millis() 計時讓 LED 閃爍，同時還能立刻偵測按鈕。比較看看：用 delay 寫的話，按鈕會不會變慢？',
    circuit: [LED13, { id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '按鈕' }, { id: 'led2', type: 'led', pin: 12, color: 'green', label: '按鈕燈' }],
    code: `// BlinkWithoutDelay：用 millis() 計時，loop 不會被卡住
const int ledPin = 13;
int ledState = LOW;
unsigned long previousMillis = 0;   // 上次切換的時間
const long interval = 1000;         // 閃爍間隔（毫秒）

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    ledState = (ledState == LOW) ? HIGH : LOW;
    digitalWrite(ledPin, ledState);
  }
  // 因為沒有 delay，按鈕可以隨時反應
  digitalWrite(12, digitalRead(2) == LOW ? HIGH : LOW);
}
`,
  },
  {
    group: '02.Digital', id: 'statechange', title: 'StateChangeDetection 按鈕計次',
    desc: '偵測按鈕「被按下的那一刻」來計算次數，每按 4 次 LED 亮一次。',
    circuit: [{ id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '按鈕' }, LED13],
    code: `// StateChangeDetection：只在狀態改變時計數
const int buttonPin = 2;
const int ledPin = 13;
int buttonPushCounter = 0;
int buttonState = 0;
int lastButtonState = HIGH;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  buttonState = digitalRead(buttonPin);
  if (buttonState != lastButtonState) {
    if (buttonState == LOW) {
      buttonPushCounter++;
      Serial.print("按了 ");
      Serial.print(buttonPushCounter);
      Serial.println(" 次");
    }
    delay(50);
  }
  lastButtonState = buttonState;

  if (buttonPushCounter % 4 == 0) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}
`,
  },
  {
    group: '02.Digital', id: 'melody', title: 'toneMelody 播放旋律',
    desc: '用陣列存音符和節拍，讓蜂鳴器播放一段旋律。記得按右上角「聲音：開」才聽得到。',
    circuit: [{ id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' }],
    code: `// toneMelody：用陣列存旋律（小星星）
#define NOTE_C4 262
#define NOTE_D4 294
#define NOTE_E4 330
#define NOTE_F4 349
#define NOTE_G4 392
#define NOTE_A4 440

int melody[] = {
  NOTE_C4, NOTE_C4, NOTE_G4, NOTE_G4, NOTE_A4, NOTE_A4, NOTE_G4,
  NOTE_F4, NOTE_F4, NOTE_E4, NOTE_E4, NOTE_D4, NOTE_D4, NOTE_C4
};
// 4 = 四分音符，2 = 二分音符
int noteDurations[] = {4, 4, 4, 4, 4, 4, 2, 4, 4, 4, 4, 4, 4, 2};

void setup() {
  int count = sizeof(melody) / sizeof(melody[0]);
  for (int i = 0; i < count; i++) {
    int noteDuration = 1000 / noteDurations[i];
    tone(8, melody[i], noteDuration);
    int pause = noteDuration * 1.30;   // 音和音之間留一點空隙
    delay(pause);
    noTone(8);
  }
}

void loop() {
  // 只播一次
}
`,
  },
  {
    group: '03.Analog', id: 'analoginout', title: 'AnalogInOutSerial 旋鈕調光',
    desc: '讀可變電阻、用 map() 換算成 0~255 控制 LED 亮度，並把兩個數字印出來。',
    circuit: [{ id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 512 }, { id: 'led1', type: 'led', pin: 9, color: 'yellow', label: 'LED' }],
    code: `// AnalogInOutSerial：輸入 0~1023 → 輸出 0~255
const int analogInPin = A0;
const int analogOutPin = 9;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(analogInPin);
  int outputValue = map(sensorValue, 0, 1023, 0, 255);
  analogWrite(analogOutPin, outputValue);

  Serial.print("sensor = ");
  Serial.print(sensorValue);
  Serial.print("\\t output = ");
  Serial.println(outputValue);
  delay(100);
}
`,
  },
  {
    group: '05.Control', id: 'switchcase', title: 'switchCase 光線分級',
    desc: '用 map() 把光敏電阻的讀值分成 4 級，再用 switch 判斷是哪一級。',
    circuit: [{ id: 'ldr', type: 'ldr', pin: 14, label: '光敏電阻', value: 600 }],
    code: `// switchCase：把亮度分成 4 個等級
void setup() {
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(A0);
  int range = map(reading, 0, 1023, 0, 3);
  switch (range) {
    case 0:
      Serial.println("很暗");
      break;
    case 1:
      Serial.println("有點暗");
      break;
    case 2:
      Serial.println("普通");
      break;
    case 3:
      Serial.println("很亮");
      break;
  }
  delay(300);
}
`,
  },
  {
    group: '04.Communication', id: 'asciitable', title: 'ASCIITable 字元編碼表',
    desc: '印出每個字元對應的十進位、十六進位、二進位編碼，練習 Serial.print 的格式參數。',
    circuit: [],
    code: `// ASCIITable：從 '!'（33）印到 '~'（126）
int thisByte = 33;

void setup() {
  Serial.begin(9600);
  Serial.println("ASCII 編碼表");
}

void loop() {
  Serial.write(thisByte);
  Serial.print(", dec: ");
  Serial.print(thisByte);
  Serial.print(", hex: ");
  Serial.print(thisByte, HEX);
  Serial.print(", bin: ");
  Serial.println(thisByte, BIN);

  if (thisByte == 126) {
    while (true) { }       // 印完就停在這裡
  }
  thisByte++;
}
`,
  },
  {
    group: '04.Communication', id: 'serialcontrol', title: '用序列埠控制 LED',
    desc: '在序列埠輸入 on 或 off（按傳送）來開關 LED，練習讀取文字指令。',
    circuit: [LED13],
    code: `// 輸入 on / off 控制 LED
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("請輸入 on 或 off");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd == "on") {
      digitalWrite(13, HIGH);
      Serial.println("LED 打開了");
    } else if (cmd == "off") {
      digitalWrite(13, LOW);
      Serial.println("LED 關掉了");
    } else {
      Serial.println("看不懂：" + cmd);
    }
  }
}
`,
  },
  {
    group: 'Servo', id: 'knob', title: 'Knob 旋鈕控制伺服馬達',
    desc: 'Servo 函式庫的範例：轉動可變電阻，伺服馬達跟著轉。',
    circuit: [{ id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 512 }, { id: 'sv', type: 'servo', pin: 9, label: '伺服馬達' }],
    code: `#include <Servo.h>

Servo myservo;

void setup() {
  myservo.attach(9);
}

void loop() {
  int val = analogRead(A0);
  val = map(val, 0, 1023, 0, 180);   // 換算成 0~180 度
  myservo.write(val);
  delay(15);
}
`,
  },
  {
    group: 'Servo', id: 'sweep', title: 'Sweep 來回擺動',
    desc: 'Servo 函式庫的範例：伺服馬達在 0~180 度之間來回轉動。',
    circuit: [{ id: 'sv', type: 'servo', pin: 9, label: '伺服馬達' }],
    code: `#include <Servo.h>

Servo myservo;
int pos = 0;

void setup() {
  myservo.attach(9);
}

void loop() {
  for (pos = 0; pos <= 180; pos += 1) {
    myservo.write(pos);
    delay(15);
  }
  for (pos = 180; pos >= 0; pos -= 1) {
    myservo.write(pos);
    delay(15);
  }
}
`,
  },
  {
    group: 'NeoPixel', id: 'neosimple', title: 'simple 逐顆點亮',
    desc: 'Adafruit NeoPixel 的範例：燈一顆一顆亮起來。',
    circuit: [{ id: 'strip', type: 'ws2812', pin: 6, count: 8, label: '燈條' }],
    code: `#include <Adafruit_NeoPixel.h>

#define PIN 6
#define NUMPIXELS 8

Adafruit_NeoPixel pixels(NUMPIXELS, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  pixels.begin();
}

void loop() {
  pixels.clear();
  for (int i = 0; i < NUMPIXELS; i++) {
    pixels.setPixelColor(i, pixels.Color(0, 150, 0));
    pixels.show();
    delay(300);
  }
}
`,
  },
  {
    group: 'NeoPixel', id: 'rainbow', title: 'rainbow 彩虹燈環',
    desc: '用 ColorHSV 讓 12 顆燈環顯示會旋轉的彩虹。',
    circuit: [{ id: 'ring', type: 'ws2812', pin: 6, count: 12, shape: 'ring', label: '燈環' }],
    code: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(12, 6, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.setBrightness(80);
}

void loop() {
  // 色相 0~65535 繞一圈就是一道彩虹
  for (long firstHue = 0; firstHue < 65536; firstHue += 512) {
    for (int i = 0; i < strip.numPixels(); i++) {
      long hue = firstHue + (i * 65536L / strip.numPixels());
      strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue)));
    }
    strip.show();
    delay(20);
  }
}
`,
  },
];
})(typeof window !== 'undefined' ? window : globalThis);
