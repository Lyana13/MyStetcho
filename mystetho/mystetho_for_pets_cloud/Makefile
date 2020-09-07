all:
	docker build -t mystetho-backend .
	docker run -it --rm -p 17654:8080 -p 10000-10100:10000-10100/udp -v $(shell pwd)/out:/root/work/out --name mystetho-backend mystetho-backend
