# Getting Started with Jenkins

- `chmod 400 jenkins.pem`
- `ssh -i "jenkins.pem" ubuntu@ec2-34-201-76-43.compute-1.amazonaws.com`

```bash
sudo apt update
sudo apt install openjdk-21-jdk
# sudo apt install fontconfig openjdk-21-jre
sudo apt update
sudo apt install -y openjdk-21-jdk fontconfig

java -version
sudo apt install -y maven
mvn -v
```

```bash
sudo wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc]" \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
sudo apt install jenkins
```

sudo apt install git
http://34.201.76.43:8080/
sudo cat /var/lib/jenkins/secrets/initialAdminPassword

fc1801d204dd406180860858e0360b5c
input password at http://34.201.76.43:8080/

and install suggested plugins
create first Admin user

apt install nginx -y  or u can use docker

go to jenkins setting and then nodes after that setting Inbuilt node set space req. to 300 MiB apply and go to jenkins home

make a new pipeline

GitHub hook trigger for GITScm polling
Pipeline script from SCM
https://github.com/amantiwari8861/_00_JenkinsSeleniumIntro.git

cat /etc/passwd
sudo visudo
jenkins ALL=(ALL) NOPASSWD: ALL
systemctl restart jenkins

http://34.201.76.43:8080/github-webhook/
application/json

/usr/lib/jvm/java-21-openjdk-amd64


```
pipeline {
    agent any

    stages {
        stage('Clone') {
            steps {
                git 'https://github.com/amantiwari8861/_00_JenkinsSeleniumIntro.git'
            }
        }

        stage('Deploy Code') {
            steps {
                sh '''
                    sudo cp -r * /var/www/html/
                    sudo systemctl restart nginx
                '''
            }
        }
    }
}
```

```
pipeline {
    agent any

    stages {
        stage('clone') {
            steps {
                git 'https://github.com/amantiwari8861/_00_JenkinsSeleniumIntro.git'
            }
        }

        stage('Deploy code') {
            steps {
                step {
                    sh '''
                        sudo cp -r * /var/www/html/
                        sudo systemctl restart nginx
                    '''
                }
            }
        }
    }
}
```

```
pipeline{
    agent any 

    stages {
        stage('clone code') {
            steps {
                git 'https://github.com/Viveksgautam/nginx-ci-cd.git'
            }
        }

        stage('Deploy code') {
            steps {
                sh '''
                sudo cp -r * /var/www/html/
                sudo systemctl restart nginx
                '''
            }
        }
    }
}
```










sudo su
apt install docker.io
apt update
docker hello-world

sudo usermod -a -G docker jenkins
chmod /var/run/docker.sock