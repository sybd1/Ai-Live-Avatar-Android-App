package kr.ongi.firststep;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FirstStepApplication {

	public static void main(String[] args) {
		SpringApplication.run(FirstStepApplication.class, args);
	}

}
