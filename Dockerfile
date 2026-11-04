FROM eclipse-temurin:21-jdk AS build
WORKDIR /build
COPY server/ ./
RUN chmod +x mvnw && ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /build/target/one_step_service-0.0.1-SNAPSHOT.jar /app/server.jar
COPY data/programs.json /app/data/programs.json
ENV SERVER_BIND_ADDRESS=0.0.0.0 SERVER_PORT=8080 PORT=8080
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-Xms64m", "-Xmx512m", "-jar", "/app/server.jar", "--import.file=/app/data/programs.json"]
