pipeline {

    agent any

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Docker Check') {
            steps {
                sh '''
                    whoami
                    docker --version
                    docker compose version
                    docker ps
                '''
            }
        }

        stage('Build') {
            steps {
                sh '''
                    docker compose build
                '''
            }
        }

        stage('Start API') {
            steps {
                sh '''
                    docker compose up -d mongo api
                '''
            }
        }

        stage('Run API Tests') {
            steps {
                sh '''
                    docker compose run --rm api-testing
                '''
            }
        }
    }

    post {

        always {
            sh '''
                docker compose down -v --remove-orphans
            '''
        }

    }
}