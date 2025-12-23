# prompt maker 
# Objective: it takes a folder name, creates a file "prompt.md" and scrapes all details from the folder, and write it tto the file
"""
structure:

relative_foldername/filename.jsx
---
<This is the content of the file>.

-- END filename.jsx --

relative_foldername/filename2.jsx
---
<This is the content of the file filename2>.

-- END filename2.jsx --

"""


import os
import re

def get_file_content(file_path):
    """
    Read the content of a file and return it as a string.
    """
    with open(file_path, 'r') as file:
        content = file.read()
    return content

def valid_filename(file_name):
    extensions = ['.jsx', '.js', '.ts', '.tsx', '.json', '.html', '.css', '.scss']
    """
    Check if the file name to be processed or not.
    """
    flag = any(file_name.endswith(ext) for ext in extensions)
    flag = flag and not "node_modules" in file_name
    flag = flag and not "package-lock" in file_name
    flag = flag and not "README" in file_name
    return flag


def extract_file_details(folder_path):
    """
    Extract details from all files in a given folder.
    """
    file_details = []
    for root, dirs, files in os.walk(folder_path):
        for file_name in files:
            file_path = os.path.join(root, file_name)
            if valid_filename(file_path):
                content = get_file_content(file_path)
                file_details.append((file_path, content))
                print(f"Extracted details from {file_name}")
    return file_details


def write_to_file(file_details, output_file):
    """
    Write the extracted details to a file.
    """
    with open(output_file, 'w') as file:
        for file_name, details in file_details:
            ext = os.path.splitext(file_name)[1].strip(".")
            # ext = ext_to_markdown(ext)
            file.write(f"filename: `{file_name}`\n```{ext}\n{details}```\n")

def create_prompt_file(folder_path, output_file='prompt.md'):
    """
    Create a prompt file by extracting details from all files in a given folder.
    """
    file_details = extract_file_details(folder_path)
    write_to_file(file_details, output_file)
    print(f"Prompt file '{output_file}' created successfully.")

if __name__ == "__main__":
    folder_path = input("Enter the folder path: ")
    create_prompt_file(folder_path)
    