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
                    docker ps
                '''
            }
        }

        stage('Build') {
            steps {
                sh '''
                    docker compose build --no-cache
                '''
            }
        }

        stage('Run API Tests') {
            steps {
                sh '''
                    docker compose up \
                        --abort-on-container-exit \
                        --exit-code-from api-testing
                '''
            }
        }
    }

    post {
        always {
            sh '''
                docker compose down --volumes --remove-orphans || true
            '''
        }
    }
}