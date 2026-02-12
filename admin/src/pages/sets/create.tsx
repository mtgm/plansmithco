import { Create, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";

export const SetCreate = () => {
    const { formProps, saveButtonProps } = useForm();

    return (
        <Create saveButtonProps={saveButtonProps}>
            <Form {...formProps} layout="vertical">
                <Form.Item
                    label="Takım Adı"
                    name="name"
                    rules={[
                        {
                            required: true,
                            message: "Lütfen takım adını giriniz",
                        },
                    ]}
                >
                    <Input />
                </Form.Item>
            </Form>
        </Create>
    );
};
