class RingBuffer:
	def __init__(self, size):
		self.data = [None for i in range(size)]
		self.len = 0

	def append_list(self, list):
		for x in list:
			self.append(x)

	def append(self, x):
		if not self.isFull():
			self.len += 1
		self.data.pop(0)
		self.data.append(x)

	def get(self):
		return self.data

	def isFull(self):
		return self.data[0] != None
