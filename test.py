import os
while True:
    file_name = input("Input: ")
    print(os.path.splitext(file_name)[1])