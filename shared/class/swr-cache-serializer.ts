// Error should be serialized as { message: <error message> }
export const serialize = (value: any) => {
  const data = { ...value };
  if (data.error) {
    data.error = { message: data.error.message };
  }
  return JSON.stringify(data);
};

export const deserialize = (value: string) => {
  const data = JSON.parse(value);
  if (data.error) {
    data.error = new Error(data.error.message);
  }
  return data;
};
