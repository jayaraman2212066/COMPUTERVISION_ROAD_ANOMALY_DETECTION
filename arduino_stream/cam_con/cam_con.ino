#include <SoftwareSerial.h>


#define WIDTH 80
#define HEIGHT 60

SoftwareSerial camSerial(10, 11); 

void setup() {
  Serial.begin(115200);
  camSerial.begin(9600);
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH); 
  Serial.println("START_FRAME");


  for (int i = 0; i < WIDTH * HEIGHT; i++) {
    byte gray = random(0, 255);
    Serial.write(gray);
  }

  Serial.println("END_FRAME");
  digitalWrite(13, LOW);
  delay(5000); 
}
