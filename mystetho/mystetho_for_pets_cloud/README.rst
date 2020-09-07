TO RUN ON HEROKU

Update comments in :
Dockerfile
server.py

Run these commands in the terminal :
heroku git:remote -a mystetho-for-pets-cloud
heroku container:login
heroku container:push web
heroku container:release web
heroku open

TO RUN THIS LOCALY

Update comments in :
Dockerfile
server.py

Run this commands in the terminal :
sudo make

Open Google Chrom at :
http://localhost:17654/
